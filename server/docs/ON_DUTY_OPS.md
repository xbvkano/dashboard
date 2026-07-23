# On-duty ops checklist (admin phone line)

Use this after Phase 1–2 so `/api/call-center/*` returns useful data. Owners can manage recurrences in the dashboard (**Employees → Schedule → Admin on-duty**). Until then you can seed manually.

---

## 1. Privileged callers (code-entry)

For each person who should dial employee codes when they call `TWILIO_ADMIN_PHONE_NUMBER`:

1. Ensure an **Employee** row exists with a real phone in `number` (prefer E.164, e.g. `+17025551212`).
2. Link that employee to a **User** (`Employee.userId` → `User.id`).
3. Set `User.role` to `OWNER`, `ADMIN`, or `SUPERVISOR`.
4. Keep `Employee.disabled = false`.

Verify:

```bash
curl -s "http://localhost:3000/api/call-center/caller-context?phone=%2B17025551212" \
  -H "X-Call-Center-Key: $CALL_CENTER_API_KEY"
# expect privileged: true
```

---

## 2. Dial-by-code targets

Anyone reachable by keypad code needs:

- `Employee.id` (code `034` = id `34`)
- `Employee.number` dialable
- `Employee.disabled = false`

Verify:

```bash
curl -s "http://localhost:3000/api/call-center/employees/by-code/001" \
  -H "X-Call-Center-Key: $CALL_CENTER_API_KEY"
```

---

## 3. Who answers non-privileged admin-line calls

`/on-duty` reads **`OnDutySchedule` only** (materialized UTC windows).

Until the Owner UI rematerializes from `OnDutyRecurrence`, insert absolute windows (or insert recurrences **and** matching schedule rows).

### Sample: single absolute window (quick test)

Replace IDs/phones/times for your DB. Times are UTC.

```sql
-- Employee 2 on duty for the next 8 hours (example)
INSERT INTO "OnDutySchedule" ("employeeId", "startAt", "endAt", "priority", "active", "createdAt", "updatedAt")
VALUES (
  2,
  NOW() - INTERVAL '1 hour',
  NOW() + INTERVAL '8 hours',
  0,
  true,
  NOW(),
  NOW()
);
```

Verify:

```bash
curl -s "http://localhost:3000/api/call-center/on-duty" \
  -H "X-Call-Center-Key: $CALL_CENTER_API_KEY"
```

### Sample: weekly recurrence + one materialized week

**Every Monday 09:00–17:00 America/Los_Angeles**, employee 2:

```sql
INSERT INTO "OnDutyRecurrence" (
  "employeeId", "dayOfWeek", "startTimeLocal", "endTimeLocal", "timeZone",
  "intervalWeeks", "phase", "anchorDate", "priority", "active", "createdAt", "updatedAt"
) VALUES (
  2,
  1,              -- Monday (0=Sun .. 6=Sat)
  '09:00',
  '17:00',
  'America/Los_Angeles',
  1,              -- every week
  0,
  DATE '2026-07-20',  -- any Monday anchor
  0,
  true,
  NOW(),
  NOW()
);
```

Then add matching `OnDutySchedule` UTC rows for the weeks you care about (Phase 4 will automate this).

### Sample: every-other-week intercalation (Sundays)

Same time block, two people alternating:

| Person | `intervalWeeks` | `phase` |
|---|---|---|
| Admin 1 (employee A) | 2 | 0 |
| Admin 2 (employee B) | 2 | 1 |

Same `anchorDate` (a Monday), same `dayOfWeek` / times. Materialize only the Sundays that match each phase into `OnDutySchedule`.

---

## 4. Priority / backups

If two windows overlap, lower `priority` is tried first. Use `0` for primary, `1` for backup.

---

## 5. Env reminder

| Service | Variable |
|---|---|
| Dashboard | `CALL_CENTER_API_KEY` |
| Call center | `CALL_CENTER_API_KEY` (same) + `DASHBOARD_API_URL` + `TWILIO_ADMIN_PHONE_NUMBER` |
| Dashboard DevTools (optional) | `CALL_CENTER_URL` (e.g. `http://localhost:5000`) to proxy TwiML |

**Twilio:** admin number voice webhook → `POST {call-center}/admin-voice` (no `/api`). Client IVR → `POST {call-center}/voice`.

Full HTTP contract: [CALL_CENTER_API.md](./CALL_CENTER_API.md).
