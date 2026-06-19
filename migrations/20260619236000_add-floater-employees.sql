-- Always-available "floater" employees for coverage demos.
-- They carry NO shifts and hold broad certifications, so they have zero scheduled
-- hours (never double-booked, always under the hours cap) and are eligible for any
-- non-manager role. Because peers are ranked by fewest scheduled hours, floaters
-- sort ahead of already-scheduled staff and get called first.
--
-- Phone numbers here are placeholders; a real, reachable number for live call tests
-- is set out-of-band on the live DB (kept out of version control — it's PII).

insert into public.employees (id, name, phone, phone_digits, role, is_manager, certifications, max_hours, status) values
  ('emp-alex',   'Alex Rivera',  '+1 555-0200', '15550200', 'barista', false, '{keyholder,barista,dishwasher,server,food}', 40, 'active'),
  ('emp-sam',    'Sam Carter',   '+1 555-0201', '15550201', 'barista', false, '{keyholder,barista,dishwasher,server,food}', 40, 'active'),
  ('emp-jordan', 'Jordan Blake', '+1 555-0202', '15550202', 'barista', false, '{keyholder,barista,dishwasher,server,food}', 40, 'active')
on conflict (id) do nothing;
