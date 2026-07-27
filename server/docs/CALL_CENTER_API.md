# Call Center API

Service-to-service HTTP API consumed by **evidence_call_center** for the admin Twilio line (`TWILIO_ADMIN_PHONE_NUMBER`). Not for browser/JWT clients.

Base path: `/api/call-center`  
Auth: shared secret `CALL_CENTER_API_KEY` (no admin JWT)

---

## Environment

### Dashboard (`server/.env`)

```env
CALL_CENTER_API_KEY=your-long-random-shared-secret
```

Without this variable, all endpoints below return **503**.

### Call center (evidence_call_center)

```env
DASHBOARD_API_URL=http://localhost:3000
CALL_CENTER_API_KEY=your-long-random-shared-secret
TWILIO_ADMIN_PHONE_NUMBER=+1…
```

Use the **same** secret on both sides.

### Twilio webhooks (call center host — no `/api`)

| Number | Voice webhook |
|---|---|
| Client `TWILIO_PHONE_NUMBER` | `POST https://<call-center-host>/voice` |
| Admin `TWILIO_ADMIN_PHONE_NUMBER` | `POST https://<call-center-host>/admin-voice` |

Do **not** prefix these with `/api`. Dashboard `GET /api/call-center/*` is only the service API that the call center calls with `CALL_CENTER_API_KEY`.

### DevTools (optional)

```env
# dashboard server/.env — proxy TwiML from Admin → DevTools
CALL_CENTER_URL=http://localhost:5000
```

---

## Authentication

Send the key with either header:

```http
X-Call-Center-Key: your-long-random-shared-secret
```

or:

```http
Authorization: Bearer your-long-random-shared-secret
```

| Situation | Status |
|---|---|
| Key missing / wrong | `401` `{ "error": "Unauthorized" }` |
| `CALL_CENTER_API_KEY` unset on server | `503` `{ "error": "CALL_CENTER_API_KEY is not configured" }` |

These routes are JWT-public so the service key is the only auth for this path.

---

## Endpoints

### 1. Caller context

Decide whether an inbound admin-line caller may use **code routing** (OWNER / ADMIN / SUPERVISOR).

```http
GET /api/call-center/caller-context?phone={e164OrNational}
```

**Query**

| Param | Required | Notes |
|---|---|---|
| `phone` | yes | Normalized via dashboard phone utils (E.164 or 10-digit US) |

**Examples**

Privileged:

```bash
curl -s "http://localhost:3000/api/call-center/caller-context?phone=%2B17025551212" \
  -H "X-Call-Center-Key: $CALL_CENTER_API_KEY"
```

```json
{
  "privileged": true,
  "employeeId": 2,
  "name": "Alex",
  "role": "OWNER"
}
```

Not privileged / unknown / invalid phone:

```json
{ "privileged": false }
```

Missing `phone`:

```json
{ "error": "phone query parameter is required" }
```

Status: `400`

**Lookup rules**

- Match `Employee.number` (variant-tolerant) where `disabled = false`
- Linked `User.role` in `OWNER` | `ADMIN` | `SUPERVISOR`

---

### 2. Employee by keypad code

Resolve a gathered code to a dial target. Code is the employee **id** (`001` → id `1`, `034` → id `34`).

```http
GET /api/call-center/employees/by-code/{code}
```

```bash
curl -s "http://localhost:3000/api/call-center/employees/by-code/034" \
  -H "X-Call-Center-Key: $CALL_CENTER_API_KEY"
```

**200**

```json
{
  "id": 34,
  "name": "Maria",
  "phoneNumber": "+17025559999",
  "role": "EMPLOYEE"
}
```

`role` may be `null` if the employee has no linked user.

**404** if code invalid, employee missing, or `disabled = true`:

```json
{ "error": "Employee not found" }
```

Do not speak `phoneNumber` to the caller in TwiML.

---

### 3. On duty

Who should answer the admin line right now (or at `at`), from **materialized** `OnDutySchedule` rows only (not recurrence math).

```http
GET /api/call-center/on-duty
GET /api/call-center/on-duty?at={isoDatetime}
```

```bash
curl -s "http://localhost:3000/api/call-center/on-duty" \
  -H "X-Call-Center-Key: $CALL_CENTER_API_KEY"

curl -s "http://localhost:3000/api/call-center/on-duty?at=2026-07-22T18:00:00.000Z" \
  -H "X-Call-Center-Key: $CALL_CENTER_API_KEY"
```

**200**

```json
{
  "candidates": [
    {
      "employeeId": 2,
      "name": "Alex",
      "phoneNumber": "+17025550001",
      "role": "OWNER",
      "priority": 0
    },
    {
      "employeeId": 5,
      "name": "Sam",
      "phoneNumber": "+17025550002",
      "role": "ADMIN",
      "priority": 1
    }
  ]
}
```

Empty when nobody is scheduled:

```json
{ "candidates": [] }
```

Invalid `at`: `400` `{ "error": "at must be a valid ISO datetime" }`

**Query rules**

- `active = true`
- `startAt <= at < endAt`
- Employee `disabled = false`
- Order: `priority ASC`, then `id ASC`

**Caller ID (applied in call center, not this API)**

- `OWNER` → show original caller number
- `ADMIN` / `SUPERVISOR` / `EMPLOYEE` / null → show `TWILIO_ADMIN_PHONE_NUMBER`

---

## Data model (summary)

| Table | Role |
|---|---|
| `Employee` + `User.role` | Phones, dial targets, privileged callers |
| `OnDutyRecurrence` | Owner-edited weekly / biweekly rules (Phase 4 UI) |
| `OnDutySchedule` | Absolute UTC windows queried by `/on-duty` |

See [ON_DUTY_OPS.md](./ON_DUTY_OPS.md) for how to link phones and seed sample duty rows.

---

## Quick smoke test

```bash
export CALL_CENTER_API_KEY=your-long-random-shared-secret
export BASE=http://localhost:3000

# expect 401
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/call-center/on-duty"

# expect 200
curl -s "$BASE/api/call-center/on-duty" -H "X-Call-Center-Key: $CALL_CENTER_API_KEY"
```
