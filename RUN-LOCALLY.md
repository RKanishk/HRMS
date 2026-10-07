# CIPL HRMS: run frontend + backend locally

```
cipl-hrms-final/
├── backend/    NestJS + PostgreSQL + Redis   (http://localhost:3001)
└── frontend/   Next.js                       (http://localhost:3000)
```

## Prerequisites
- Node 24.15+ for the backend (Node 22+ is enough for the frontend)
- Docker Desktop (PostgreSQL 17 + Redis 7)

## 1. Backend
```bash
cd backend
docker compose up -d postgres redis
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm run db:seed
npm start            # takes ~20 s to boot; check http://localhost:3001/api/v1/health/ready
```
`backend/.env` is already filled in for local use (fresh encryption key, ports and passwords matching docker-compose).
Swagger: http://localhost:3001/api/docs

## 2. Frontend
```bash
cd frontend
npm ci
npm run dev          # http://localhost:3000
```
`frontend/.env.local` already points at the backend and turns demo mode off.
To browse with fake data and no backend, delete `NEXT_PUBLIC_DEMO_MODE=false` from `.env.local`.

## 3. Sign in (password for all: `SeedOnly!Cipl2026`)
| Email | Role | Notes |
|---|---|---|
| `admin@cipl.example` | Super admin | sees the HR screens |
| `hr@cipl.example` | HR admin | sees the HR screens; no employee profile attached |
| `employee20@cipl.example` | HR executive | HR screens **and** a personal profile |
| `employee01@cipl.example` | Manager | has 19 direct reports |
| `employee02@cipl.example` … `employee19@…` | Employee | self-service |

Payroll needs two people: one processes (`hr@`), a different one approves and locks (`admin@`). The backend enforces this.

## What was changed to make the two fit
The screens were built against assumed API shapes. The backend's real API differs in paths, paging
(`items/meta` vs `data/meta`), field names, roles, and CSRF. Instead of rewriting every screen, the frontend now has
`frontend/src/lib/backend/` (an adapter at the network boundary, the same place the demo mocks live):

- `http.ts`: backend client: cookie session, `X-CSRF-Token`, automatic session refresh, paging helpers
- `handlers.ts`: one translation per screen endpoint → real backend endpoint(s) → shape the screen expects
- `adapter.ts`: plugs it into the existing axios client; chosen automatically when demo mode is off

Also: `SUPER_ADMIN`/`HR_EXECUTIVE` now map to the HR UI role; API validation messages are shown in full; file
downloads no longer trip the "got a web page" guard.

Verified: `LIVE_API=1 npx vitest run src/lib/backend/live.test.ts` runs 7 end-to-end checks against a seeded backend
(login for 3 roles, org CRUD, employee create/edit, leave apply/cancel, regularization request/approve, documents upload,
payroll create → process → approve → lock → payslip, reports + CSV). Existing 68 unit tests, lint, typecheck and
production build also pass.

## Limits that come from the backend (not bugs)
- **Document verify/reject**: the backend has no review workflow. Documents show as "Pending", and Verify/Reject returns a clear message.
- **Excel export**: backend exports CSV only; "Export Excel" shows an error, use CSV.
- **Payslip download** is a printable HTML page (print to PDF from the browser), not a PDF file.
- **Employee address** must be typed as `street, city, state, PIN` (the backend stores the parts separately).
- **Branch city** and **holiday type** aren't stored by the backend (city shows blank; all holidays are "Public").
- **Leave-type yearly days** can be set once per year; the backend makes policies immutable.
- **Shifts/employees with history** can't have times/assignments changed (backend protects attendance & payroll history).
- **Offboarding** tasks can be ticked, but closing the case (which deactivates the account) is deliberately left to be done on/after the last working day.
- Login is rate-limited (30 attempts per minute per IP, `AUTH_RATE_LIMIT` in `backend/.env`).
- Leave "days" preview on the apply form is an estimate; the backend recalculates and enforces the real figure on submit.
