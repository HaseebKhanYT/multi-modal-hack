# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**TeemTalk** (repo/InsForge project name: `multi-modal-hack`) is a voice-first agent that automates shift leave requests and last-minute coverage for small shift-based teams. An employee calls in, the agent captures the leave and releases the shift, then autonomously calls eligible teammates one at a time until the shift is covered, escalating to the manager only as a last resort.

**`PRD.md` is the source of truth** for scope, requirements (FR-1…FR-25), the data model (§11), and the architecture (§10). Read it before designing anything non-trivial — the MVP boundary, deferred features, and accepted risks are all spelled out there, and many decisions that look open are already resolved in §15.

## Current state — read this first

The repo is at the **integration-spike** stage, not the full build. What actually exists:

- `migrations/20260619210400_create-leave-requests.sql` — a single trimmed `leave_requests` table (a subset of the PRD §11 `LeaveRequest` entity), explicitly marked as throwaway scaffolding to be superseded by the real data-model migration.
- `functions/vapi-webhook.ts` — the Vapi tool server, implementing only two tools (`create_leave_request`, `list_leave_requests`) to prove the voice → LLM → tool → Postgres path end-to-end.

The dashboard, the full data model (Employee / Shift / CoverageTask / CallAttempt / AuditEvent), the eligibility engine, the coverage-dispatch loop, the `ScheduleProvider` abstraction, and pg_cron sweeps described in the PRD **do not exist yet**. Don't assume PRD components are built — verify against the filesystem.

## Architecture (target)

Voice and reasoning are split across providers; InsForge is the backend and state layer:

- **Vapi** owns the phone calls and STT/TTS (inbound intake + outbound dispatch).
- **Nebius AI Studio** is the LLM "brain," reached via Vapi's `custom-llm` (OpenAI-compatible, SSE streaming) — only reasoning/tool-calling is routed there.
- **InsForge edge functions** (Deno/TypeScript) host the Vapi tools and webhook handler; **InsForge Postgres + RLS** holds workflow/audit state; realtime powers the (future) manager dashboard.
- A single `vapi-webhook` edge function is intended to multiplex all Vapi traffic behind a **Hono** router (Hono used as a library *inside* the function, not a separate service). The current spike is a hand-rolled handler; the Hono router is still to come.
- The schedule of record sits behind a **`ScheduleProvider`** interface: ship `LocalScheduleProvider` (InsForge `Shift` table as source of truth) so the whole loop is buildable/demoable without Square; `SquareScheduleProvider` (Labor API + webhook reconciliation) drops in behind the same interface later.

## Vapi tool-call contract

Edge functions that serve Vapi tools follow this shape (see `functions/vapi-webhook.ts`):

- **Request:** `{ message: { toolCallList: [ { id, function: { name, arguments } } ], call?: {...} } }`
- **Response:** `{ results: [ { toolCallId, result } ] }`
- `function.arguments` may arrive as a JSON **string or an object** depending on model/runtime — always normalize (see `parseArgs`).
- Caller phone (for caller-ID identity, FR-1) is at `message.call.customer.number`.
- Auth is an optional shared secret via the `x-vapi-secret` header, enforced only when `VAPI_SERVER_SECRET` is set.

## InsForge conventions

This project's backend is [InsForge](https://insforge.dev) (Postgres BaaS). **Use the installed InsForge skills rather than guessing the API or CLI** — `insforge` (app/SDK code), `insforge-cli` (migrations, SQL, functions, secrets, deploys), `insforge-debug` (failures, RLS/auth, audits). See `AGENTS.md` for the project's API base and key patterns.

- Edge functions read config from env: `INSFORGE_BASE_URL`, `API_KEY`, `VAPI_SERVER_SECRET`. The CLI reads `.insforge/project.json`. **Never hardcode or commit keys.**
- Edge functions reach the DB via the **admin (service) client** (`createAdminClient` from `npm:@insforge/sdk`), which **bypasses RLS** — that's why the spike table can have RLS on with no policies (locked to everything except the service key). Dashboard-facing read policies come with the real data model.
- DB inserts take an **array**: `.insert([{ ... }])`. Reference users with `auth.users(id)` and `auth.uid()` in RLS.
- Migrations live in `migrations/` as timestamped `.sql` files (note: PRD §10 anticipates a future `db/migrations/` monorepo layout — the repo isn't there yet).

## Git workflow

Follow the user's global workflow in `~/.claude/CLAUDE.md`: sync `main`, branch as `<type>/<short-kebab-desc>`, stage files explicitly, commit the *why*, push with `-u`, open a PR, and **stop — do not merge**. No Claude attribution in commits or PR bodies. One PR = one logical change.

## Tooling note

There is no `package.json`, build, lint, or test setup in the repo yet — edge functions run on InsForge's Deno runtime and TypeScript is checked there. When you add app code (e.g. the Vite/React dashboard) or a test harness, document the commands here.
