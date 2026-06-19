-- Outbound dispatch tracking for the coverage call-down loop.
-- Adds in-flight call bookkeeping to coverage_tasks and an append-only call_attempts
-- log (PRD §11 CallAttempt subset). The vapi-webhook function reaches these via the
-- admin (service) key, which bypasses RLS.

-- In-flight call bookkeeping: which Vapi call is currently ringing for this task,
-- and when it started (used by the pg_cron safety sweep to detect stalls).
alter table public.coverage_tasks add column if not exists current_call_id        text;
alter table public.coverage_tasks add column if not exists current_call_started_at timestamptz;

-- Append-only record of every outbound dispatch attempt.
create table if not exists public.call_attempts (
  id               uuid primary key default gen_random_uuid(),
  coverage_task_id uuid references public.coverage_tasks(id),
  shift_id         text references public.shifts(id),
  employee_id      text references public.employees(id),
  vapi_call_id     text,
  channel          text not null default 'voice',
  -- calling | accepted | declined | no-answer | uncovered | simulated | call-failed | skipped-no-number
  outcome          text not null,
  created_at       timestamptz not null default now()
);
create index if not exists call_attempts_task_idx     on public.call_attempts (coverage_task_id);
create index if not exists call_attempts_shift_idx    on public.call_attempts (shift_id);
create index if not exists call_attempts_created_idx  on public.call_attempts (created_at desc);

alter table public.call_attempts enable row level security;
