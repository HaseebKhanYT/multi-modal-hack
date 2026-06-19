# Foundation: full data model, ScheduleProvider abstraction, and Hono router restructure

**Design spec for GitHub issue #3** · Date: 2026-06-19 · Status: approved (pending written-spec review)

## Context

TeemTalk is at the integration-spike stage. The spike — `functions/vapi-webhook.ts` (two hand-rolled tools) and `migrations/…create-leave-requests.sql` (a trimmed `leave_requests` table) — was throwaway validation. It proved the voice → LLM → tool → Postgres path end-to-end (Vapi → Nebius Llama-3.3-70B → InsForge CRUD, validated 2026-06-19). **The spike code is reference only; this work rebuilds a clean foundation, carrying the learnings forward, not the code.**

`PRD.md` is the source of truth — data model in §11, architecture in §10. This spec delivers the "enabling prefactor" every later slice builds on: the full data model, the `ScheduleProvider` seam, and a Hono-routed webhook.

### Current repo state (on `main`)

- Tracked: `PRD.md`, `AGENTS.md`, `.gitignore`, `frontend/` (Vite + React dashboard, currently driven by simulated data).
- Untracked (spike, reference only): `functions/vapi-webhook.ts`, `migrations/…create-leave-requests.sql`, `CLAUDE.md`.
- The live InsForge dev project (`multi-modal-hack`) has the throwaway `leave_requests` table from the spike, holding only test rows.
- `.gitignore` excludes `.insforge`, `.claude`, etc. — secrets are never committed; edge functions read config from env, the CLI from `.insforge/project.json`.

## Goals

1. Expand the schema to the full PRD §11 entity set (six entities) with RLS, applied cleanly to the live InsForge project.
2. Introduce a vendor-agnostic `ScheduleProvider` interface with a tested `LocalScheduleProvider` (InsForge `Shift` table as source of truth).
3. Restructure `vapi-webhook` behind a Hono router with shared-secret verification and per-tool schema validation; re-home the two existing tools onto the new model + provider with the tool-call contract unchanged.

## Non-goals (deferred to later slices, per PRD)

- Eligibility engine, coverage-dispatch loop, escalation, notifications (FR-8…FR-20).
- The **transactional atomic claim** (`SECURITY DEFINER` fn + uniqueness constraint, FR-16) — `assignShift` here is a plain update.
- Coverage-task **enqueue** on leave intake — the intake tool stops at "leave logged + shift released."
- `SquareScheduleProvider`, pg_cron sweeps, Square webhook reconciliation.
- Dashboard read RLS policies and realtime wiring; the `frontend/` dashboard keeps its simulated data for now.

## Decisions (locked with the user)

| Decision | Choice |
| --- | --- |
| Packaging | **Three sequential PRs**: data model → ScheduleProvider → Hono router. PR2 opens after PR1 merges; PR3 after PR2. |
| Spike code | Throwaway; rebuild clean, carry learnings only. **No spike-data backfill.** |
| Test strategy | `deno test` against an **injected in-memory data port** — fast, offline, no credentials. |
| Migration apply | I apply it to the **live** `multi-modal-hack` project via insforge-cli and verify. |
| Repo layout | Move toward the PRD monorepo: `frontend/` (exists), `functions/`, **`db/migrations/`** (new), **`shared/`** (new). |
| Schema validation | `npm:zod` per-tool schemas in the Hono router. |
| CLAUDE.md | Keep and commit it; update its "Current state" / layout sections in each PR. |

## Architecture overview

```
shared/                         # vendor-agnostic domain + provider seam (PR2)
  schedule/
    types.ts                    # Shift, ShiftStatus, ScheduleProvider, ShiftStore, errors
    local-schedule-provider.ts  # LocalScheduleProvider (depends on a ShiftStore)
    in-memory-shift-store.ts    # test fake implementing ShiftStore
    local-schedule-provider.test.ts
functions/
  vapi-webhook.ts               # Hono router (PR3): middleware + tool dispatch + zod validation
db/migrations/
  <ts>_create-data-model.sql    # six tables + RLS (PR1)
frontend/                       # existing dashboard (unchanged by this work)
```

Data access is split so the provider is unit-testable: `LocalScheduleProvider` depends on a narrow `ShiftStore` port. The real runtime wires an `InsForgeShiftStore` (admin client → `shifts` table); tests wire an `InMemoryShiftStore`. The provider holds the domain logic (release clears the assignee and opens the shift; assign sets the assignee and marks it assigned); the store holds only row read/update.

---

## PR 1 — Full data model migration (`feat/full-data-model`)

**Deliverables:** `db/migrations/<ts>_create-data-model.sql`; remove the untracked `migrations/` spike file; commit `CLAUDE.md` with an updated "Current state"; apply to the live project and verify.

Six tables matching PRD §11. Conventions: `uuid` PKs (`gen_random_uuid()`); reserved words avoided (`start`/`end` → `starts_at`/`ends_at`); statuses as `text` + `CHECK` (easier to evolve than PG enums); native arrays for lists; `jsonb` for audit before/after; `timestamptz` timestamps.

### `employees`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| name | text not null | |
| phone | text unique not null | caller-ID identity key (FR-1) |
| role | text | |
| certifications | text[] not null default '{}' | |
| status | text not null default 'active' | CHECK in (`active`,`inactive`) |
| max_hours | integer | nullable; basic hours awareness (FR-11) |
| is_manager | boolean not null default false | escalation target |
| created_at | timestamptz not null default now() | |

### `shifts`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| location | text | |
| role_required | text | |
| starts_at | timestamptz not null | |
| ends_at | timestamptz not null | |
| assigned_employee_id | uuid → employees(id) | nullable; ON DELETE SET NULL |
| status | text not null default 'scheduled' | CHECK in (`scheduled`,`open`,`assigned`,`cancelled`) |
| created_at | timestamptz not null default now() | |

### `leave_requests`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| employee_id | uuid not null → employees(id) | |
| shift_id | uuid → shifts(id) | nullable; ON DELETE SET NULL |
| type | text not null | sick/emergency/personal/planned/vacation (FR-4) |
| reason | text | **private** — never broadcast (FR-5) |
| approval_status | text not null default 'not_required' | CHECK in (`not_required`,`pending`,`approved`,`denied`); forward-compat (FR-6) |
| created_at | timestamptz not null default now() | |

### `coverage_tasks`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| shift_id | uuid not null → shifts(id) | |
| status | text not null default 'queued' | CHECK in (`queued`,`in_progress`,`covered`,`escalated`,`uncovered`,`cancelled`) |
| candidate_queue | uuid[] not null default '{}' | ordered employee ids |
| current_candidate | uuid → employees(id) | nullable |
| attempts | integer not null default 0 | |
| escalation_status | text not null default 'none' | CHECK in (`none`,`manager_called`,`manager_declined`,`alert_raised`) |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |

### `call_attempts`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| task_id | uuid not null → coverage_tasks(id) | |
| employee_id | uuid not null → employees(id) | |
| channel | text not null default 'voice' | CHECK in (`voice`,`sms`) — sms is post-MVP |
| outcome | text not null | CHECK in (`accepted`,`declined`,`no_answer`,`voicemail`,`unintelligible`,`failed`) |
| occurred_at | timestamptz not null default now() | |

### `audit_events`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| actor | text | employee id, `system`, or `agent` |
| action | text not null | |
| entity | text not null | table name |
| entity_id | uuid | affected row |
| before | jsonb | |
| after | jsonb | |
| occurred_at | timestamptz not null default now() | |

**Indexes:** `employees(phone)` (unique, for caller-ID lookup), `shifts(status)`, `shifts(starts_at)`, `leave_requests(employee_id)`, `coverage_tasks(status)`, `call_attempts(task_id)`, `audit_events(entity, entity_id)`.

**RLS:** `ENABLE ROW LEVEL SECURITY` on all six, **no policies** — deny-all to anon/authenticated, while the edge function's admin/service key bypasses RLS (same lock-down the spike used). This satisfies "leave reasons not readable by non-privileged roles." Dashboard-facing read policies arrive in a later slice.

**Spike teardown:** `DROP TABLE IF EXISTS public.leave_requests;` first (the spike table holds only test rows — no backfill), then create the new schema. The new `leave_requests` is the full LeaveRequest entity.

**Apply + verify (insforge-cli):** apply the migration to the live project; verify all six tables exist with the expected columns, FKs, CHECKs, indexes, and RLS enabled; confirm the old spike table is gone. Use the `insforge-cli` skill for the exact commands.

**Acceptance mapping:** AC#1 (six entities, PRD fields, applies cleanly), AC#2 (RLS on, admin access works, reasons not readable), AC#6 (layout: `db/migrations/`).

---

## PR 2 — ScheduleProvider + LocalScheduleProvider (`feat/schedule-provider`)

**Deliverables:** `shared/schedule/` — `types.ts`, `local-schedule-provider.ts`, `in-memory-shift-store.ts`, `local-schedule-provider.test.ts`; update `CLAUDE.md`.

### Interfaces (`shared/schedule/types.ts`)

```ts
export type ShiftStatus = 'scheduled' | 'open' | 'assigned' | 'cancelled';

export interface Shift {
  id: string;
  location: string | null;
  roleRequired: string | null;
  startsAt: string;            // ISO 8601
  endsAt: string;
  assignedEmployeeId: string | null;
  status: ShiftStatus;
}

// Vendor-agnostic schedule-of-record contract. Square drops in behind this later.
export interface ScheduleProvider {
  getShift(id: string): Promise<Shift | null>;
  releaseShift(id: string): Promise<Shift>;                       // vacate: clear assignee, status -> 'open'
  assignShift(id: string, employeeId: string): Promise<Shift>;   // assign: set assignee, status -> 'assigned'
}

// Narrow data-access port LocalScheduleProvider depends on (enables offline unit tests).
export interface ShiftStore {
  findById(id: string): Promise<Shift | null>;
  update(id: string, patch: Partial<Shift>): Promise<Shift>;
}

export class ShiftNotFoundError extends Error {}
```

### `LocalScheduleProvider`

Constructed with a `ShiftStore`. Logic:

- `getShift(id)` → `store.findById(id)`.
- `releaseShift(id)` → load (throw `ShiftNotFoundError` if missing); `store.update(id, { assignedEmployeeId: null, status: 'open' })`.
- `assignShift(id, employeeId)` → load (throw if missing); `store.update(id, { assignedEmployeeId: employeeId, status: 'assigned' })`.

The transactional atomic claim (FR-16) is explicitly **not** here — `assignShift` is a straightforward update; the claim guard lands with the coverage-dispatch slice.

### `InMemoryShiftStore` (test fake)

A `Map<string, Shift>` implementing `ShiftStore`, with a seed helper. No network, no DB.

### Runtime wiring (used by PR3)

`InsForgeShiftStore implements ShiftStore` — wraps the admin client, mapping `shifts` rows ↔ `Shift` (snake_case ↔ camelCase, `starts_at`↔`startsAt`, etc.). Defined where the edge function can import it (e.g. `shared/schedule/insforge-shift-store.ts`); exercised live in PR3.

### Tests (`deno test`)

- `getShift` returns the shift; returns `null` on miss.
- `releaseShift` clears `assignedEmployeeId` and sets status `open`.
- `assignShift` sets `assignedEmployeeId` and status `assigned`.
- `releaseShift`/`assignShift` on a missing id throw `ShiftNotFoundError`.

Document the command in `CLAUDE.md`: `deno test shared/`.

**Acceptance mapping:** AC#3 (interface defined; `LocalScheduleProvider` read/release/assign against the Shift model with unit tests), AC#6 (`shared/`).

---

## PR 3 — Hono router restructure (`refactor/vapi-hono-router`)

**Deliverables:** rewrite `functions/vapi-webhook.ts` using Hono (`npm:hono`) + `npm:zod`; re-home the two tools onto the new model + provider; update `CLAUDE.md`. Carries spike learnings: `parseArgs` (args may arrive as JSON string or object), caller-ID at `message.call.customer.number`, optional `x-vapi-secret` shared secret.

### Structure

Vapi posts all traffic to one URL, so the function exposes a single `POST /` (plus `OPTIONS` for CORS). Hono provides middleware + clean organization:

- **Middleware:** CORS; shared-secret verification (`x-vapi-secret` vs `VAPI_SERVER_SECRET`, enforced only when the secret is set — matches spike behavior); centralized error handling returning in-contract errors.
- **Dispatch on `message.type`:**
  - `tool-calls` → iterate `message.toolCallList[]`, validate + run each tool, respond `{ results: [{ toolCallId, result }] }` (contract unchanged).
  - `status-update`, `end-of-call-report` → acknowledge with `200` (handlers stubbed; coverage-task advancement is the dispatch slice — kept out of scope here so the router is complete but lean).
- **Per-tool zod schemas:** each tool has a `zod` schema; invalid args yield a clean spoken-style tool error string in the result, not a thrown 500.

### Re-homed tools (onto new model + provider)

- `create_leave_request`: resolve the employee via `message.call.customer.number` (FR-1; fall back to a provided name when no caller number), insert a `leave_requests` row with `employee_id`, `type`, `reason`. **Shift to release = the employee's next upcoming shift** — the earliest `shifts` row for that `assigned_employee_id` with `starts_at` in the future and status `scheduled`/`assigned`. If found, call `provider.releaseShift(shiftId)` and set `leave_requests.shift_id`; if none, log the leave without a shift link. Returns the same confirmation shape as the spike. **Coverage-task enqueue is deferred.**
- `list_leave_requests`: query the new `leave_requests` joined to `employees` (resolve the name), most recent first.

Both tools use `InsForgeShiftStore` + `LocalScheduleProvider` from `shared/` and the admin client for `employees`/`leave_requests`.

### Verification

- Unit-validate the zod schemas (`deno test`).
- Live smoke against the deployed function with a sample `tool-calls` payload for each tool, asserting the `{ results: [...] }` contract still holds and rows land in the new tables. Use the `insforge-cli` / `insforge-debug` skills for deploy + logs.

**Acceptance mapping:** AC#4 (Hono routing, signature/shared-secret verification, per-tool schema validation), AC#5 (existing tools work end-to-end on the new model + provider, contract unchanged).

---

## Error handling

- Migration: idempotent guards (`IF NOT EXISTS`/`IF EXISTS`); apply in a transaction so a failure rolls back cleanly.
- Provider: missing shift → typed `ShiftNotFoundError`; store/DB errors propagate to the caller (the tool layer converts them to spoken-style messages).
- Router: invalid JSON → `400`; bad secret → `401`; unknown `message.type` → `200` ack (don't error Vapi); per-tool validation failure → in-contract error result; unexpected exceptions caught centrally and returned as a tool error rather than a raw 500.

## Testing summary

- `deno test shared/` — provider logic against the in-memory store (offline, no credentials).
- zod schema unit tests in PR3.
- Live verification: migration applied + inspected (PR1); deployed-function smoke for both tools (PR3).

## Git / workflow

Per `~/.claude/CLAUDE.md`: each PR syncs `main`, branches `<type>/<short-kebab-desc>`, stages files explicitly, commits the *why*, pushes `-u`, opens a PR, then **stops** (no merge, no Claude attribution, one logical change per PR). PR2 starts after PR1 merges; PR3 after PR2. This design doc lands first on `docs/foundation-design`.

## Acceptance criteria coverage (issue #3)

- [x] AC#1 six entities with PRD §11 fields, applies cleanly → PR1
- [x] AC#2 RLS on all tables; admin access works; reasons not readable → PR1
- [x] AC#3 `ScheduleProvider` + `LocalScheduleProvider` read/release/assign with unit tests → PR2
- [x] AC#4 `vapi-webhook` via Hono with secret verification + per-tool schema validation → PR3
- [x] AC#5 existing tools work end-to-end on new model + provider (contract unchanged) → PR3
- [x] AC#6 repo layout reflects the monorepo plan (`functions/`, `db/migrations/`, `shared/`; `frontend/` already present) → PR1–PR3
