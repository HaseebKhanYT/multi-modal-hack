// vapi-webhook — Vapi tool server for the TeemTalk leave -> coverage -> assignment loop.
//
// Vapi (brain = Nebius via custom-llm) calls this function whenever the model emits a
// tool_call. Contract:
//   Request : { message: { toolCallList: [ { id, function: { name, arguments } } ], call?: {...} } }
//   Response: { results: [ { toolCallId, result } ] }
//
// Tools (all return a short, voice-friendly string the model speaks back):
//   Inbound intake (employee calls in):
//     - identify_caller(phone?)                         -> caller-ID identity (FR-1/2)
//     - list_my_shifts(employee_name?, phone?)          -> caller's upcoming shifts
//     - create_leave_request(leave_type, shift_id? | shift_date?, reason?, employee_name?)
//                                                        -> log leave, release shift, build coverage queue
//     - list_leave_requests(employee_name?)             -> recent requests
//   Outbound dispatch (agent calls teammates):
//     - find_coverage_candidates(shift_id)              -> ranked eligible peers + escalation outcome
//     - record_coverage_response(shift_id, employee_name, accepted)
//                                                        -> assign + close on accept; log on decline
//
// Outbound call-down: create_leave_request places the first coverage call; the queue then
// advances one teammate at a time, driven by Vapi 'end-of-call-report' webhooks (with a
// pg_cron safety sweep as backstop), until someone accepts, the manager is reached, or the
// shift is flagged uncovered. Real dials are gated on VAPI_PHONE_NUMBER_ID (else 'simulated').
// Also handles { action: 'sweep' } (cron) and acks other Vapi server messages.
//
// Eligibility (FR-8/9/10/11/12/17): role/cert match, no double-booking, hours cap,
// requester excluded, peers ranked by fewest scheduled hours, managers only as a
// last-resort escalation. DB access uses the admin (service) client, which bypasses RLS.

import { createAdminClient } from 'npm:@insforge/sdk';

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? 'https://smsfb7r9.us-east.insforge.app';
const API_KEY = Deno.env.get('API_KEY') ?? '';
const VAPI_SERVER_SECRET = Deno.env.get('VAPI_SERVER_SECRET') ?? '';

// Outbound dispatch config. Real calls are placed only when VAPI_PHONE_NUMBER_ID is set;
// without it the loop still runs but dials are recorded as 'simulated' (testable, no telephony).
const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY') ?? '';
const VAPI_PHONE_NUMBER_ID = Deno.env.get('VAPI_PHONE_NUMBER_ID') ?? '';
const COVERAGE_ASSISTANT_ID = Deno.env.get('COVERAGE_ASSISTANT_ID') ?? 'e1e64548-df56-4bf6-bd87-39f0a5e63dea';
const STALE_CALL_MS = 90_000; // sweep advances pending tasks whose call has run longer than this

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-vapi-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const admin = createAdminClient({ baseUrl: BASE_URL, apiKey: API_KEY });

// ---------------------------------------------------------------------------
// Types (mirror the migration columns)
// ---------------------------------------------------------------------------
interface Employee {
  id: string;
  name: string;
  phone: string | null;
  phone_digits: string | null;
  role: string;
  is_manager: boolean;
  certifications: string[];
  max_hours: number;
  status: string;
}

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role_required: string;
  assigned_employee_id: string | null;
  status: string; // assigned | open | covered
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Arguments may arrive as an object or a JSON string depending on the model/runtime.
function parseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw as Record<string, unknown>;
}

const digitsOnly = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const firstName = (name: string) => name.split(/\s+/)[0] || name;

// Hours a shift spans (handles HH:MM or HH:MM:SS). All demo shifts are 8h.
function shiftHours(s: Shift): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  return Math.max(0, (toMin(s.end_time) - toMin(s.start_time)) / 60);
}

// Two shifts collide if they're the same day and their time windows overlap.
function overlaps(a: Shift, b: Shift): boolean {
  if (a.shift_date !== b.shift_date) return false;
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

async function loadEmployees(): Promise<Employee[]> {
  const { data, error } = await admin.database.from('employees').select('*');
  if (error) throw new Error(error.message ?? 'failed to load employees');
  return (data as Employee[]) ?? [];
}

async function loadShifts(): Promise<Shift[]> {
  const { data, error } = await admin.database.from('shifts').select('*');
  if (error) throw new Error(error.message ?? 'failed to load shifts');
  return (data as Shift[]) ?? [];
}

// Resolve the caller: prefer caller-ID phone, fall back to a spoken name (FR-1/2).
function resolveEmployee(
  employees: Employee[],
  callerPhone: string | null,
  spokenName?: string,
): Employee | null {
  const callerDigits = digitsOnly(callerPhone);
  if (callerDigits) {
    const byPhone = employees.find((e) => e.phone_digits && callerDigits.endsWith(e.phone_digits));
    if (byPhone) return byPhone;
  }
  const name = (spokenName ?? '').trim().toLowerCase();
  if (name) {
    return employees.find((e) => e.name.toLowerCase().includes(name)) ?? null;
  }
  return null;
}

// Currently-worked hours for an employee, ignoring released (open) shifts and one excluded shift.
function scheduledHours(emp: Employee, shifts: Shift[], excludeShiftId?: string): number {
  return shifts
    .filter((s) => s.assigned_employee_id === emp.id && s.status !== 'open' && s.id !== excludeShiftId)
    .reduce((sum, s) => sum + shiftHours(s), 0);
}

interface Eligibility {
  queue: string[];              // ordered employee ids: eligible peers, then eligible manager(s)
  escalation: string | null;    // null | 'escalated_manager' | 'uncovered'
  peers: Employee[];
  managers: Employee[];
}

// The eligibility engine (FR-8/9/10/11/12/17).
function computeEligibility(shift: Shift, requesterId: string | null, employees: Employee[], shifts: Shift[]): Eligibility {
  const need = shift.role_required;
  const hours = shiftHours(shift);

  const eligible = employees.filter((e) => {
    if (e.id === requesterId) return false;                 // FR-10: requester excluded
    if (e.status !== 'active') return false;
    const roleMatch = e.role === need || e.certifications.includes(need); // FR-9
    if (!roleMatch) return false;
    const doubleBooked = shifts.some(                       // FR-8
      (s) => s.assigned_employee_id === e.id && s.id !== shift.id && s.status !== 'open' && overlaps(s, shift),
    );
    if (doubleBooked) return false;
    if (scheduledHours(e, shifts, shift.id) + hours > e.max_hours) return false; // FR-11
    return true;
  });

  // FR-12: rank peers by fewest scheduled hours (fairness), then by name.
  const byLoad = (a: Employee, b: Employee) =>
    scheduledHours(a, shifts, shift.id) - scheduledHours(b, shifts, shift.id) || a.name.localeCompare(b.name);

  const peers = eligible.filter((e) => !e.is_manager).sort(byLoad);
  const managers = eligible.filter((e) => e.is_manager).sort(byLoad); // FR-17: last resort

  const queue = [...peers, ...managers].map((e) => e.id);
  const escalation = queue.length === 0 ? 'uncovered' : peers.length === 0 ? 'escalated_manager' : null;
  return { queue, escalation, peers, managers };
}

// ---------------------------------------------------------------------------
// Outbound dispatch loop
// ---------------------------------------------------------------------------

const shiftTimeLabel = (s: Shift) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;

// Voice-friendly spoken forms for the outbound call, so TTS says "Monday, June 22, 7am to 3pm"
// instead of reading "2026-06-22" and "07:00–15:00" as raw numbers.
const spokenDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const spokenClock = (t: string) => {
  let [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
};
const spokenTime = (s: Shift) => `${spokenClock(s.start_time)} to ${spokenClock(s.end_time)}`;

interface CoverageTask {
  id: string;
  shift_id: string;
  status: string;
  candidate_queue: string[];
  current_candidate: string | null;
  attempts: number;
  escalation_status: string | null;
  current_call_id: string | null;
}

// Place (or simulate) one outbound coverage call to `candidate`, and record it on the task.
// Returns the call id now tracked on the task. Telephony is gated on VAPI_PHONE_NUMBER_ID;
// without it (or on failure) a synthetic id is used so the loop stays drivable by the sweep.
async function placeCoverageCall(task: CoverageTask, shift: Shift, candidate: Employee): Promise<{ callId: string; outcome: string }> {
  const variableValues = {
    employee_first_name: firstName(candidate.name),
    shift_id: shift.id,
    shift_role: shift.role_required,
    shift_date: spokenDate(shift.shift_date),
    shift_time: spokenTime(shift),
  };

  let callId: string | null = null;
  let outcome = 'calling';
  if (VAPI_PHONE_NUMBER_ID && VAPI_API_KEY && candidate.phone_digits) {
    try {
      const res = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: { Authorization: `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: COVERAGE_ASSISTANT_ID,
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          customer: { number: `+${candidate.phone_digits}`, name: candidate.name },
          assistantOverrides: { variableValues },
        }),
      });
      const data = await res.json().catch(() => ({}));
      callId = data?.id ?? null;
      outcome = callId ? 'calling' : 'call-failed';
    } catch {
      outcome = 'call-failed';
    }
  } else {
    outcome = 'simulated';
  }
  if (!callId) callId = `${outcome}-${shift.id}-${Date.now()}`;

  await admin.database.from('coverage_tasks').update({
    current_candidate: candidate.id,
    current_call_id: callId,
    current_call_started_at: new Date().toISOString(),
    attempts: (task.attempts ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', task.id);

  await admin.database.from('call_attempts').insert([{
    coverage_task_id: task.id,
    shift_id: shift.id,
    employee_id: candidate.id,
    vapi_call_id: callId,
    outcome,
  }]);

  return { callId, outcome };
}

// Advance a pending task past its current (unanswered/declined) candidate to the next in the
// queue — dialling them, or marking the task uncovered when the queue is exhausted.
async function advanceCoverage(task: CoverageTask, shift: Shift, employees: Employee[]): Promise<{ action: string; candidate?: Employee }> {
  const queue = task.candidate_queue ?? [];
  const idx = task.current_candidate ? queue.indexOf(task.current_candidate) : -1;
  const nextId = queue[idx + 1];
  if (!nextId) {
    await admin.database.from('coverage_tasks').update({
      status: 'uncovered', escalation_status: 'uncovered', current_call_id: null, updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    await admin.database.from('call_attempts').insert([{
      coverage_task_id: task.id, shift_id: shift.id, employee_id: task.current_candidate, outcome: 'uncovered',
    }]);
    return { action: 'uncovered' };
  }
  const next = employees.find((e) => e.id === nextId)!;
  await placeCoverageCall({ ...task }, shift, next);
  return { action: 'called', candidate: next };
}

// Vapi end-of-call-report handler: when a coverage call ends without acceptance, move on.
// Matches on current_call_id, so a call that already led to accept (cleared) or decline-advance
// (replaced) is ignored — making this idempotent against duplicate/late reports.
async function handleEndOfCall(call: Record<string, unknown>): Promise<string> {
  const callId = call?.id as string | undefined;
  if (!callId) return 'no call id';
  const { data } = await admin.database.from('coverage_tasks').select('*').eq('current_call_id', callId).eq('status', 'pending').limit(1);
  const task = (data as CoverageTask[])?.[0];
  if (!task) return 'no pending task for this call (covered or already advanced)';
  const shifts = await loadShifts();
  const shift = shifts.find((s) => s.id === task.shift_id);
  if (!shift) return 'shift not found';
  const result = await advanceCoverage(task, shift, await loadEmployees());
  return result.action === 'called' ? `advanced to ${result.candidate!.name}` : 'marked uncovered';
}

// pg_cron safety sweep: advance any pending task whose in-flight call has run too long
// (a lost/never-delivered end-of-call report). Returns how many tasks were advanced.
async function runSweep(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_CALL_MS).toISOString();
  const { data } = await admin.database.from('coverage_tasks')
    .select('*').eq('status', 'pending').lt('current_call_started_at', cutoff);
  const tasks = ((data as CoverageTask[]) ?? []).filter((t) => t.current_call_id);
  if (tasks.length === 0) return 0;
  const [shifts, employees] = [await loadShifts(), await loadEmployees()];
  let advanced = 0;
  for (const task of tasks) {
    const shift = shifts.find((s) => s.id === task.shift_id);
    if (shift) { await advanceCoverage(task, shift, employees); advanced++; }
  }
  return advanced;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

async function identifyCaller(args: Record<string, unknown>, callerPhone: string | null): Promise<string> {
  const employees = await loadEmployees();
  const emp = resolveEmployee(employees, callerPhone ?? (args.phone ? String(args.phone) : null), String(args.employee_name ?? ''));
  if (!emp) {
    return "I couldn't match this number to anyone on the team, so I can't make scheduling changes on this call.";
  }
  const role = emp.is_manager ? `${emp.role} (manager)` : emp.role;
  return `You're verified as ${emp.name}, ${role}.`;
}

async function listMyShifts(args: Record<string, unknown>, callerPhone: string | null): Promise<string> {
  const employees = await loadEmployees();
  const emp = resolveEmployee(employees, callerPhone ?? (args.phone ? String(args.phone) : null), String(args.employee_name ?? ''));
  if (!emp) return "I couldn't verify who you are, so I can't look up your shifts.";

  const shifts = await loadShifts();
  const mine = shifts
    .filter((s) => s.assigned_employee_id === emp.id && s.status === 'assigned')
    .sort((a, b) => (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time));
  if (mine.length === 0) return `${firstName(emp.name)}, you have no upcoming assigned shifts on the schedule.`;

  const lines = mine.map((s) => `${s.id} on ${s.shift_date} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} (${s.role_required})`);
  return `${firstName(emp.name)}, you have ${mine.length} upcoming shift${mine.length === 1 ? '' : 's'}: ${lines.join('; ')}.`;
}

async function createLeaveRequest(args: Record<string, unknown>, callerPhone: string | null): Promise<string> {
  const leave_type = String(args.leave_type ?? '').trim() || 'time-off';
  const employees = await loadEmployees();
  const emp = resolveEmployee(employees, callerPhone, String(args.employee_name ?? ''));
  if (!emp) {
    // FR-1/2: unknown caller — deny scheduling actions, log nothing.
    return "I couldn't verify you as a team member, so I can't log a leave request or change the schedule.";
  }

  const shifts = await loadShifts();
  const shiftId = args.shift_id ? String(args.shift_id).trim() : '';
  const shiftDate = args.shift_date ? String(args.shift_date).trim() : '';
  let shift: Shift | null = null;
  if (shiftId) {
    shift = shifts.find((s) => s.id === shiftId) ?? null;
  } else if (shiftDate) {
    shift = shifts.find((s) => s.assigned_employee_id === emp.id && s.shift_date === shiftDate && s.status === 'assigned') ?? null;
  }

  // Log the leave request (linked to employee/shift where known).
  const { data: lrData, error: lrError } = await admin.database
    .from('leave_requests')
    .insert([{
      employee_id: emp.id,
      employee_name: emp.name,
      caller_phone: callerPhone,
      leave_type,
      shift_id: shift?.id ?? null,
      shift_date: shift?.shift_date ?? (shiftDate || null),
      reason: args.reason ? String(args.reason) : null,
    }])
    .select();
  if (lrError) return `Sorry, I couldn't save the leave request: ${lrError.message ?? 'unknown error'}.`;
  const leaveRequest = Array.isArray(lrData) ? lrData[0] : lrData;
  const ref = String(leaveRequest?.id ?? '').slice(0, 8);

  if (!shift) {
    // The caller's actual upcoming shifts — used to steer the model back to a real shift
    // instead of letting it guess one (which previously released the wrong day's shift).
    const mine = shifts
      .filter((s) => s.assigned_employee_id === emp.id && s.status === 'assigned')
      .sort((a, b) => (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time));
    const mineSpoken = mine.map((s) => `${spokenDate(s.shift_date)} (${shiftTimeLabel(s)}, ${s.role_required})`).join('; ');

    if (shiftDate) {
      // A date was named but the caller has no assigned shift then. Refuse firmly and DO NOT
      // invite substituting a different shift — name only their real shifts so they confirm.
      const base = `${firstName(emp.name)}, you're not scheduled on ${spokenDate(shiftDate)}, so there's no shift of yours to release that day.`;
      return mine.length
        ? `${base} Your upcoming shifts are: ${mineSpoken}. Which of those did you mean? (Logged note, reference ${ref}.)`
        : `${base} You have no upcoming assigned shifts on the schedule. (Logged note, reference ${ref}.)`;
    }
    // Neither a usable shift id nor date — ask, listing the caller's real shifts to pick from.
    return mine.length
      ? `Got it ${firstName(emp.name)} — logged a ${leave_type} request (reference ${ref}). Which shift should I release? Your upcoming shifts are: ${mineSpoken}.`
      : `Got it ${firstName(emp.name)} — logged a ${leave_type} request (reference ${ref}), but I don't see any upcoming shifts assigned to you to release.`;
  }
  if (shift.assigned_employee_id !== emp.id) {
    return `That shift (${shift.id}) isn't assigned to you, ${firstName(emp.name)}, so I can't release it. Your leave note is logged (reference ${ref}).`;
  }

  // Release the shift.
  await admin.database.from('shifts').update({ status: 'open' }).eq('id', shift.id);
  shift.status = 'open';

  // Build the coverage queue and persist the task.
  const elig = computeEligibility(shift, emp.id, employees, shifts);
  const { data: ctData } = await admin.database.from('coverage_tasks').insert([{
    shift_id: shift.id,
    leave_request_id: leaveRequest?.id ?? null,
    status: elig.queue.length === 0 ? 'uncovered' : 'pending',
    candidate_queue: elig.queue,
    escalation_status: elig.escalation,
  }]).select();
  const task = (Array.isArray(ctData) ? ctData[0] : ctData) as CoverageTask;

  const when = `${shift.shift_date} ${shiftTimeLabel(shift)}`;
  const base = `Done, ${firstName(emp.name)} — ${leave_type} approved and ${shift.id} (${shift.role_required}, ${when}) released. Reference ${ref}.`;

  if (elig.queue.length === 0) {
    return `${base} I don't have an eligible teammate to cover it, so I'm flagging it as uncovered for your manager.`;
  }
  // Kick off the outbound call-down to the first candidate.
  const first = employees.find((e) => e.id === elig.queue[0])!;
  await placeCoverageCall(task, shift, first);
  if (elig.escalation === 'escalated_manager') {
    return `${base} No eligible teammate is available, so I'll reach out to your manager ${firstName(first.name)} to cover.`;
  }
  return `${base} I'll start calling ${firstName(first.name)} to cover it and let you know how it goes.`;
}

async function findCoverageCandidates(args: Record<string, unknown>): Promise<string> {
  const shiftId = String(args.shift_id ?? '').trim();
  if (!shiftId) return 'I need the shift id to find coverage candidates.';
  const [employees, shifts] = [await loadEmployees(), await loadShifts()];
  const shift = shifts.find((s) => s.id === shiftId);
  if (!shift) return `I couldn't find a shift with id ${shiftId}.`;

  const requesterId = shift.assigned_employee_id; // whoever still holds it / requested off
  const elig = computeEligibility(shift, requesterId, employees, shifts);
  const nameOf = (id: string) => firstName(employees.find((e) => e.id === id)?.name ?? id);

  if (elig.queue.length === 0) {
    return `No eligible teammate can cover ${shift.id} (${shift.role_required}, ${shift.shift_date}). This one needs to escalate to the manager or be flagged uncovered.`;
  }
  if (elig.escalation === 'escalated_manager') {
    return `No peer is eligible for ${shift.id}; the only option is the manager ${elig.queue.map(nameOf).join(', ')}.`;
  }
  return `Eligible to cover ${shift.id} (${shift.role_required}, ${shift.shift_date}), in call order: ${elig.queue.map(nameOf).join(', ')}.`;
}

async function recordCoverageResponse(args: Record<string, unknown>): Promise<string> {
  const shiftId = String(args.shift_id ?? '').trim();
  const responder = String(args.employee_name ?? '').trim();
  const acceptedRaw = args.accepted;
  const accepted = acceptedRaw === true || String(acceptedRaw).toLowerCase() === 'true' || String(acceptedRaw).toLowerCase() === 'yes';
  if (!shiftId || !responder) return 'I need the shift id and who responded to record the answer.';

  const { data: taskData, error: taskErr } = await admin.database
    .from('coverage_tasks').select('*').eq('shift_id', shiftId).order('created_at', { ascending: false }).limit(1);
  if (taskErr) return `Sorry, I couldn't load the coverage task: ${taskErr.message ?? 'unknown error'}.`;
  const task = (taskData as CoverageTask[])?.[0];
  if (!task) return `I don't have an open coverage task for ${shiftId}.`;

  const employees = await loadEmployees();
  const emp = employees.find((e) => e.name.toLowerCase().includes(responder.toLowerCase()));
  if (!emp) return `I couldn't match "${responder}" to anyone on the team.`;

  if (accepted) {
    // Terminal: assign the shift and close the task. Clearing current_call_id stops the
    // end-of-call handler / sweep from advancing past the person who just accepted.
    await admin.database.from('shifts').update({ status: 'covered', assigned_employee_id: emp.id }).eq('id', shiftId);
    await admin.database.from('coverage_tasks')
      .update({ status: 'covered', current_candidate: emp.id, current_call_id: null, updated_at: new Date().toISOString() })
      .eq('id', task.id);
    await admin.database.from('call_attempts').insert([{
      coverage_task_id: task.id, shift_id: shiftId, employee_id: emp.id, vapi_call_id: task.current_call_id, outcome: 'accepted',
    }]);
    return `${firstName(emp.name)} accepted — ${shiftId} is now covered and reassigned to them. Closing this out.`;
  }

  // Decline: just log it. The queue advances when this call ends (end-of-call report or
  // the safety sweep), which keeps the call-down strictly sequential and race-free.
  await admin.database.from('call_attempts').insert([{
    coverage_task_id: task.id, shift_id: shiftId, employee_id: emp.id, vapi_call_id: task.current_call_id, outcome: 'declined',
  }]);
  const queue = task.candidate_queue ?? [];
  const nextId = queue[queue.indexOf(emp.id) + 1];
  if (!nextId) {
    return `Thanks anyway, ${firstName(emp.name)} — that was the last person I could ask, so I'll flag this shift for the manager.`;
  }
  const nextEmp = employees.find((e) => e.id === nextId)!;
  const lead = nextEmp.is_manager ? `I'll reach out to the manager ${firstName(nextEmp.name)} next` : `I'll try ${firstName(nextEmp.name)} next`;
  return `No problem, ${firstName(emp.name)} — thanks for letting me know. ${lead}.`;
}

async function listLeaveRequests(args: Record<string, unknown>): Promise<string> {
  const name = String(args.employee_name ?? '').trim();
  let q = admin.database.from('leave_requests').select('*').order('created_at', { ascending: false }).limit(5);
  if (name) q = q.ilike('employee_name', `%${name}%`);
  const { data, error } = await q;
  if (error) return `Sorry, I couldn't look up the requests: ${error.message ?? 'unknown error'}.`;
  const rows = (data as Array<Record<string, unknown>>) ?? [];
  if (rows.length === 0) return name ? `I found no leave requests for ${name}.` : 'There are no leave requests on file yet.';
  const lines = rows.map((r) => {
    const when = r.shift_date ? ` on ${r.shift_date}` : '';
    return `${r.employee_name}: ${r.leave_type}${when} (${r.status})`;
  });
  return `Found ${rows.length} recent request${rows.length === 1 ? '' : 's'}: ${lines.join('; ')}.`;
}

async function runTool(name: string, args: Record<string, unknown>, callerPhone: string | null): Promise<string> {
  switch (name) {
    case 'identify_caller': return await identifyCaller(args, callerPhone);
    case 'list_my_shifts': return await listMyShifts(args, callerPhone);
    case 'create_leave_request': return await createLeaveRequest(args, callerPhone);
    case 'find_coverage_candidates': return await findCoverageCandidates(args);
    case 'record_coverage_response': return await recordCoverageResponse(args);
    case 'list_leave_requests': return await listLeaveRequests(args);
    default: return `Unknown tool "${name}".`;
  }
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Optional shared-secret check (enforced only once VAPI_SERVER_SECRET is set).
  if (VAPI_SERVER_SECRET && req.headers.get('x-vapi-secret') !== VAPI_SERVER_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const message = body?.message ?? body;

  // Safety sweep trigger (pg_cron / manual): advance any stalled pending coverage tasks.
  if (body?.action === 'sweep' || message?.action === 'sweep') {
    const swept = await runSweep();
    return json({ swept });
  }

  // Vapi end-of-call report: the active coverage call ended — advance the call-down.
  if (message?.type === 'end-of-call-report') {
    const note = await handleEndOfCall(message?.call ?? {});
    return json({ received: true, note });
  }

  const toolCalls = message?.toolCallList ?? body?.toolCallList ?? [];
  const callerPhone: string | null = message?.call?.customer?.number ?? null;

  // Other Vapi server messages (status-update, etc.) carry no tool calls — just acknowledge.
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    if (message?.type) return json({ received: true });
    return json({ error: 'No toolCallList found in request' }, 400);
  }

  const results = [];
  for (const tc of toolCalls) {
    const id = tc?.id ?? tc?.toolCallId;
    const name = tc?.function?.name ?? tc?.name;
    const args = parseArgs(tc?.function?.arguments ?? tc?.arguments);
    let result: string;
    try {
      result = await runTool(name, args, callerPhone);
    } catch (e) {
      result = `Tool "${name}" failed: ${(e as Error).message}`;
    }
    results.push({ toolCallId: id, result });
  }

  return json({ results });
}
