-- Roster, schedule, and coverage state for the leave -> coverage -> assignment loop.
-- Brings the PRD §11 Employee / Shift / CoverageTask entities into the DB (MVP subset)
-- and seeds them with the demo/seed-data.md fixture (Bean Scene — Downtown).
--
-- The vapi-webhook edge function reaches these via the admin (service) key, which
-- bypasses RLS — that's why RLS is enabled with no policies (locked to everything
-- except the service key). Dashboard-facing read policies come later.

-- ---------------------------------------------------------------------------
-- Employees (roster) — PRD §11 Employee subset
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id             text primary key,                 -- readable id, e.g. 'emp-maya'
  name           text not null,
  phone          text,                             -- display form, e.g. '+1 555-0100'
  phone_digits   text,                             -- digits only, for caller-ID match
  role           text not null,                    -- barista | dishwasher | server | manager
  is_manager     boolean not null default false,
  certifications text[] not null default '{}',
  max_hours      integer not null default 40,
  status         text not null default 'active',
  created_at     timestamptz not null default now()
);
create index if not exists employees_phone_digits_idx on public.employees (phone_digits);

-- ---------------------------------------------------------------------------
-- Shifts (schedule of record) — PRD §11 Shift subset
-- ---------------------------------------------------------------------------
create table if not exists public.shifts (
  id                   text primary key,            -- readable id, e.g. 'shift-m1'
  location             text not null default 'Bean Scene — Downtown',
  shift_date           date not null,
  start_time           time not null,
  end_time             time not null,
  role_required        text not null,
  assigned_employee_id text references public.employees(id),
  status               text not null default 'assigned',  -- assigned | open | covered
  created_at           timestamptz not null default now()
);
create index if not exists shifts_assigned_idx on public.shifts (assigned_employee_id);
create index if not exists shifts_date_idx on public.shifts (shift_date);

-- ---------------------------------------------------------------------------
-- Coverage tasks — PRD §11 CoverageTask subset (drives the outbound dispatch loop)
-- ---------------------------------------------------------------------------
create table if not exists public.coverage_tasks (
  id                uuid primary key default gen_random_uuid(),
  shift_id          text not null references public.shifts(id),
  leave_request_id  uuid references public.leave_requests(id),
  status            text not null default 'pending',   -- pending | covered | uncovered
  candidate_queue   text[] not null default '{}',      -- ordered employee ids (peers, then manager)
  current_candidate text,                              -- employee id currently being called
  attempts          integer not null default 0,
  escalation_status text,                              -- null | escalated_manager | uncovered
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists coverage_tasks_shift_idx   on public.coverage_tasks (shift_id);
create index if not exists coverage_tasks_status_idx on public.coverage_tasks (status);

-- ---------------------------------------------------------------------------
-- Link leave_requests to the new entities (kept nullable for spike compatibility)
-- ---------------------------------------------------------------------------
alter table public.leave_requests add column if not exists employee_id text references public.employees(id);
alter table public.leave_requests add column if not exists shift_id    text references public.shifts(id);

-- ---------------------------------------------------------------------------
-- Lock the tables down (admin/service key bypasses RLS; no anon/authenticated access)
-- ---------------------------------------------------------------------------
alter table public.employees      enable row level security;
alter table public.shifts         enable row level security;
alter table public.coverage_tasks enable row level security;

-- ---------------------------------------------------------------------------
-- Seed: roster (demo/seed-data.md). Idempotent via ON CONFLICT DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.employees (id, name, phone, phone_digits, role, is_manager, certifications, max_hours, status) values
  ('emp-maya',   'Maya Ortiz',  '+1 555-0100', '15550100', 'manager',    true,  '{keyholder,barista,food}', 40, 'active'),
  ('emp-liam',   'Liam Chen',   '+1 555-0101', '15550101', 'barista',    false, '{keyholder,barista,food}', 32, 'active'),
  ('emp-priya',  'Priya Nair',  '+1 555-0102', '15550102', 'barista',    false, '{keyholder,barista,food}', 40, 'active'),
  ('emp-marcus', 'Marcus Webb', '+1 555-0103', '15550103', 'dishwasher', false, '{}',                       30, 'active'),
  ('emp-sofia',  'Sofia Rossi', '+1 555-0104', '15550104', 'dishwasher', false, '{}',                       32, 'active'),
  ('emp-noah',   'Noah Kim',    '+1 555-0105', '15550105', 'server',      false, '{food}',                  40, 'active')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: schedule (Mon 2026-06-22 → Wed 2026-06-24, all status=assigned)
-- ---------------------------------------------------------------------------
insert into public.shifts (id, shift_date, start_time, end_time, role_required, assigned_employee_id) values
  ('shift-m1', '2026-06-22', '07:00', '15:00', 'barista',    'emp-liam'),
  ('shift-m2', '2026-06-22', '07:00', '15:00', 'manager',    'emp-maya'),
  ('shift-m3', '2026-06-22', '07:00', '15:00', 'dishwasher', 'emp-marcus'),
  ('shift-m4', '2026-06-22', '07:00', '15:00', 'server',     'emp-noah'),
  ('shift-m5', '2026-06-22', '15:00', '23:00', 'barista',    'emp-priya'),
  ('shift-m6', '2026-06-22', '15:00', '23:00', 'dishwasher', 'emp-sofia'),
  ('shift-t1', '2026-06-23', '07:00', '15:00', 'barista',    'emp-priya'),
  ('shift-t2', '2026-06-23', '07:00', '15:00', 'dishwasher', 'emp-sofia'),
  ('shift-t3', '2026-06-23', '07:00', '15:00', 'server',     'emp-noah'),
  ('shift-t4', '2026-06-23', '15:00', '23:00', 'barista',    'emp-liam'),
  ('shift-t5', '2026-06-23', '15:00', '23:00', 'dishwasher', 'emp-marcus'),
  ('shift-t6', '2026-06-23', '15:00', '23:00', 'manager',    'emp-maya'),
  ('shift-w1', '2026-06-24', '07:00', '15:00', 'barista',    'emp-liam'),
  ('shift-w2', '2026-06-24', '07:00', '15:00', 'barista',    'emp-priya'),
  ('shift-w3', '2026-06-24', '07:00', '15:00', 'dishwasher', 'emp-sofia'),
  ('shift-w4', '2026-06-24', '07:00', '15:00', 'server',     'emp-noah'),
  ('shift-w5', '2026-06-24', '15:00', '23:00', 'dishwasher', 'emp-marcus'),
  ('shift-w6', '2026-06-24', '15:00', '23:00', 'manager',    'emp-maya')
on conflict (id) do nothing;
