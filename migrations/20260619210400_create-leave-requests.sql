-- Minimal leave_requests table for the VAPI -> Nebius -> backend-CRUD integration spike.
-- A trimmed subset of the PRD §11 LeaveRequest entity; enough to exercise Create + Read
-- through the full voice -> LLM -> tool -> Postgres path. Will be superseded by the full
-- data-model migration during implementation.

create table if not exists public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  caller_phone  text,
  employee_name text not null,
  leave_type    text not null,
  shift_date    date,
  reason        text,
  status        text not null default 'received',
  created_at    timestamptz not null default now()
);

create index if not exists leave_requests_employee_name_idx
  on public.leave_requests (lower(employee_name));

create index if not exists leave_requests_created_at_idx
  on public.leave_requests (created_at desc);

-- Lock the table down: RLS on with no policies means no anon/authenticated access.
-- The vapi-webhook edge function reaches it via the admin (service) API key, which
-- bypasses RLS. Dashboard-facing read policies come later with the full data model.
alter table public.leave_requests enable row level security;
