// vapi-webhook — Vapi tool server for the Teem.Talk integration spike.
//
// Vapi (brain = Nebius via custom-llm) calls this function whenever the model emits a
// tool_call. Contract:
//   Request : { message: { toolCallList: [ { id, function: { name, arguments } } ], call?: {...} } }
//   Response: { results: [ { toolCallId, result } ] }
//
// Two tools are implemented against public.leave_requests (Create + Read):
//   - create_leave_request(employee_name, leave_type, shift_date?, reason?)
//   - list_leave_requests(employee_name?)
//
// DB access uses the admin (service) client, which bypasses RLS.

import { createAdminClient } from 'npm:@insforge/sdk';

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? 'https://smsfb7r9.us-east.insforge.app';
const API_KEY = Deno.env.get('API_KEY') ?? '';
const VAPI_SERVER_SECRET = Deno.env.get('VAPI_SERVER_SECRET') ?? '';

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

// Arguments may arrive as an object or a JSON string depending on the model/runtime.
function parseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw as Record<string, unknown>;
}

async function createLeaveRequest(args: Record<string, unknown>, callerPhone: string | null): Promise<string> {
  const employee_name = String(args.employee_name ?? '').trim();
  const leave_type = String(args.leave_type ?? '').trim();
  if (!employee_name || !leave_type) {
    return 'I need at least the employee name and the type of leave to log the request.';
  }
  const row = {
    employee_name,
    leave_type,
    shift_date: args.shift_date ? String(args.shift_date) : null,
    reason: args.reason ? String(args.reason) : null,
    caller_phone: callerPhone,
  };
  const { data, error } = await admin.database.from('leave_requests').insert([row]).select();
  if (error) return `Sorry, I could not save the leave request: ${error.message ?? 'unknown error'}.`;
  const saved = Array.isArray(data) ? data[0] : data;
  const ref = String(saved?.id ?? '').slice(0, 8);
  const when = row.shift_date ? ` for ${row.shift_date}` : '';
  return `Got it — logged a ${leave_type} leave request for ${employee_name}${when}. Your reference is ${ref}.`;
}

async function listLeaveRequests(args: Record<string, unknown>): Promise<string> {
  const name = String(args.employee_name ?? '').trim();
  let q = admin.database.from('leave_requests').select('*').order('created_at', { ascending: false }).limit(5);
  if (name) q = q.ilike('employee_name', `%${name}%`);
  const { data, error } = await q;
  if (error) return `Sorry, I could not look up the requests: ${error.message ?? 'unknown error'}.`;
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
    case 'create_leave_request': return await createLeaveRequest(args, callerPhone);
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
  const toolCalls = message?.toolCallList ?? body?.toolCallList ?? [];
  const callerPhone: string | null = message?.call?.customer?.number ?? null;

  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
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
