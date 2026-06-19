# Demo Seed Data — TeemTalk

Fictional roster and schedule for demoing and testing the leave → coverage → assignment loop. Field names follow the PRD §11 data model (`Employee`, `Shift`). All people, phone numbers, and the business are made up.

- **Business:** Bean Scene — Downtown (single location, café)
- **Team:** 6 employees — 1 manager, 2 baristas, 2 dishwashers, 1 server
- **Demo week:** Mon 2026-06-22 → Wed 2026-06-24 (relative to "today" = Fri 2026-06-19)
- **Shift length:** 8h. Open = 07:00–15:00, Close = 15:00–23:00.

> Note on current code: the integration spike (`functions/vapi-webhook.ts`) only persists `leave_requests` (`employee_name`, `caller_phone`, `leave_type`, …). The `Employee`/`Shift` tables below don't exist in the DB yet — this file is the fixture for when they do, and for driving demo calls in the meantime. For a spike call, the relevant fields are **name** + **phone** (caller-ID, FR-1).

---

## Employees

| id          | name          | phone           | role       | is_manager | certifications              | max_hours | status |
| ----------- | ------------- | --------------- | ---------- | ---------- | --------------------------- | --------- | ------ |
| emp-maya    | Maya Ortiz    | +1 555-0100     | manager    | ✅ yes     | keyholder, barista, food    | 40        | active |
| emp-liam    | Liam Chen     | +1 555-0101     | barista    | no         | keyholder, barista, food    | 32        | active |
| emp-priya   | Priya Nair    | +1 555-0102     | barista    | no         | keyholder, barista, food    | 40        | active |
| emp-marcus  | Marcus Webb   | +1 555-0103     | dishwasher | no         | —                           | 30        | active |
| emp-sofia   | Sofia Rossi   | +1 555-0104     | dishwasher | no         | —                           | 32        | active |
| emp-noah    | Noah Kim      | +1 555-0105     | server     | no         | food                        | 40        | active |

**Roles & coverage notes**

- **Manager (Maya)** is the escalation contact (FR-17). She also holds a `barista` cert, so she can *cover* a barista shift when no non-manager barista is eligible — but she is only called after the candidate list is exhausted.
- **Keyholders** (Maya, Liam, Priya) are required to work any *Open* shift. Marcus, Sofia, and Noah cannot open.
- **Server (Noah)** is the only person with the `server` role → a server call-out has no peer coverage and must escalate (tests the "requester is the only eligible candidate" edge case, §13).
- **`max_hours`** is set so Marcus (30) sits near his cap to exercise hours awareness (FR-11); others have headroom.

---

## Shift Schedule (assigned)

Each row is one `Shift` (`location` = Bean Scene — Downtown for all). All start out `status = assigned`.

| id        | date       | day | start | end   | role_required | assigned_employee |
| --------- | ---------- | --- | ----- | ----- | ------------- | ----------------- |
| shift-m1  | 2026-06-22 | Mon | 07:00 | 15:00 | barista       | Liam Chen         |
| shift-m2  | 2026-06-22 | Mon | 07:00 | 15:00 | manager       | Maya Ortiz        |
| shift-m3  | 2026-06-22 | Mon | 07:00 | 15:00 | dishwasher    | Marcus Webb       |
| shift-m4  | 2026-06-22 | Mon | 07:00 | 15:00 | server        | Noah Kim          |
| shift-m5  | 2026-06-22 | Mon | 15:00 | 23:00 | barista       | Priya Nair        |
| shift-m6  | 2026-06-22 | Mon | 15:00 | 23:00 | dishwasher    | Sofia Rossi       |
| shift-t1  | 2026-06-23 | Tue | 07:00 | 15:00 | barista       | Priya Nair        |
| shift-t2  | 2026-06-23 | Tue | 07:00 | 15:00 | dishwasher    | Sofia Rossi       |
| shift-t3  | 2026-06-23 | Tue | 07:00 | 15:00 | server        | Noah Kim          |
| shift-t4  | 2026-06-23 | Tue | 15:00 | 23:00 | barista       | Liam Chen         |
| shift-t5  | 2026-06-23 | Tue | 15:00 | 23:00 | dishwasher    | Marcus Webb       |
| shift-t6  | 2026-06-23 | Tue | 15:00 | 23:00 | manager       | Maya Ortiz        |
| shift-w1  | 2026-06-24 | Wed | 07:00 | 15:00 | barista       | Liam Chen         |
| shift-w2  | 2026-06-24 | Wed | 07:00 | 15:00 | barista       | Priya Nair        |
| shift-w3  | 2026-06-24 | Wed | 07:00 | 15:00 | dishwasher    | Sofia Rossi       |
| shift-w4  | 2026-06-24 | Wed | 07:00 | 15:00 | server        | Noah Kim          |
| shift-w5  | 2026-06-24 | Wed | 15:00 | 23:00 | dishwasher    | Marcus Webb       |
| shift-w6  | 2026-06-24 | Wed | 15:00 | 23:00 | manager       | Maya Ortiz        |

**Scheduled hours this week** (each person works 3 × 8h = 24h):

| Employee | Shifts            | Hours | max_hours | Headroom for one 8h cover |
| -------- | ----------------- | ----- | --------- | ------------------------- |
| Maya     | m2, t6, w6        | 24    | 40        | yes (→32)                 |
| Liam     | m1, t4, w1        | 24    | 32        | yes (→32, exactly at cap) |
| Priya    | m5, t1, w2        | 24    | 40        | yes (→32)                 |
| Marcus   | m3, t5, w5        | 24    | 30        | **no** (→32 > 30)         |
| Sofia    | m6, t2, w3        | 24    | 32        | yes (→32, exactly at cap) |
| Noah     | m4, t3, w4        | 24    | 40        | yes (→32)                 |

---

## Test Scenarios

Each scenario = a caller requesting leave on one shift, plus the eligibility outcome the system should produce. Eligibility rules referenced: no double-booking (FR-8), role/cert match (FR-9), not on own leave (FR-10), hours cap (FR-11), round-robin ranking (FR-12), escalation (FR-17/18).

### ✅ 1. Barista — clean auto-coverage (happy path)
**Liam calls out `shift-m1`** (Mon Open, barista).
- Eligible baristas not already on a Mon-Open shift: **Priya** (she's on m5, the Mon *Close* — no overlap). Liam is the requester (excluded). Maya is a manager (skipped unless list empties).
- Priya +8h → 32 ≤ 40, holds keyholder + barista → **eligible**.
- **Expected:** call Priya → accept → claim & assign `shift-m1` → notify all. No manager involvement. (FR-8/9/12/16/19)

### ✅ 2. Dishwasher — auto-coverage with the other dishwasher
**Marcus calls out `shift-t5`** (Tue Close, dishwasher).
- Other dishwasher **Sofia** is on t2 (Tue Open, 07:00–15:00) — no overlap with 15:00–23:00 → no double-book. Sofia 24+8 = 32 ≤ 32 → **eligible** (exactly at cap, still allowed).
- **Expected:** call Sofia → accept → assign. (FR-8/11/16)

### ⚠️ 3. Barista — escalation (no eligible peer, manager covers)
**Liam calls out `shift-w1`** (Wed Open, barista).
- Other barista **Priya is already on `shift-w2`** — the *same* Wed-Open window → double-book, **ineligible** (FR-8).
- No other non-manager barista exists → candidate list exhausted.
- **Maya** (manager, barista cert, free Wed morning — she's on w6 Close) is the escalation contact and *can* cover.
- **Expected:** exhaust candidates → escalate to Maya → Maya accepts → assign. (FR-17, edge case "requester is only eligible candidate")

### ⚠️ 4. Dishwasher — escalation via hours cap (FR-11)
**Sofia calls out `shift-w3`** (Wed Open, dishwasher).
- Only other dishwasher **Marcus** is on w5 (Wed Close, no overlap) but is at 24h with `max_hours = 30`; +8 → 32 **> 30** → **ineligible on hours** (FR-11).
- No other dishwasher → escalate to Maya. (Maya has no dishwasher cert, so this surfaces the manager *decision* / potential uncovered-shift alert, FR-18.)
- **Expected:** no eligible candidate → escalate; if Maya can't/declines → raise uncovered-shift alert (never silently resolved).

### ⚠️ 5. Server — escalation (single-role, no peer)
**Noah calls out `shift-t3`** (Tue Open, server).
- No other employee holds the `server` role → empty candidate list immediately (FR-9).
- **Expected:** escalate to Maya for a decision; if unfilled → uncovered-shift alert (FR-18).

### 🧪 6. Edge — manager requests leave
**Maya calls out `shift-t6`** (Tue Close, manager).
- The requester is the escalation contact. Per §13, fall back to a secondary escalation contact (not configured in this fixture) → raise an uncovered-shift alert.
- **Expected:** surfaces the "manager is the requester / no secondary contact" path for manual handling.

### 🧪 7. Identity — unknown caller (FR-1/FR-2)
A call from a number **not** in the roster (e.g. `+1 555-0199`).
- **Expected:** no caller-ID match → route to voicemail, deny all scheduling actions. No `leave_request` created.

---

## Quick reference — caller-ID map (for live demo calls)

| Dial from   | Resolves to | Try requesting off |
| ----------- | ----------- | ------------------ |
| +1 555-0100 | Maya Ortiz  | shift-t6 (scn 6)   |
| +1 555-0101 | Liam Chen   | shift-m1 (scn 1) / shift-w1 (scn 3) |
| +1 555-0102 | Priya Nair  | —                  |
| +1 555-0103 | Marcus Webb | shift-t5 (scn 2)   |
| +1 555-0104 | Sofia Rossi | shift-w3 (scn 4)   |
| +1 555-0105 | Noah Kim    | shift-t3 (scn 5)   |
| +1 555-0199 | (unknown)   | scn 7 — denied     |
