# CIPL HRMS – Frontend

Internal HR system for CIPL (~280 employees). Next.js + React + TypeScript + Tailwind CSS 4, TanStack Query, React Hook Form + Zod, Axios, Recharts, date-fns, Lucide. The NestJS API is the source of truth; this app never computes authoritative HR or payroll figures.

**Status: Stage 4 of 5.** Stage 4 adds payroll (runs, review, approve, lock) and payslips, documents (upload, review), onboarding/offboarding checklists, notifications (bell + page) and reports (headcount, attendance, leave, payroll; CSV/Excel export when the server supports it). Employees and managers also get a self-service dashboard.

**Earlier (Stage 3):** Stage 3 adds attendance (daily, monthly, my calendar, team, regularizations) and leave (balances, apply, history, approvals, calendars, leave types).

**Earlier (Stage 2):** Done: shell, auth, role-aware navigation, HR dashboard, organization (departments, designations, branches, shifts), holidays, employee list/profile/create/edit. Attendance, leave, payroll, documents and reports are listed in navigation but still render a "not built yet" page.

## Requirements

Node 22+, npm 10+.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

## Backend configuration

`NEXT_PUBLIC_API_URL` selects the API (local `http://localhost:3001/api/v1`, a shared dev host, or production). Only non-secret values belong in `NEXT_PUBLIC_*`.
**Demo mode** serves sample data from `src/lib/mocks` and needs no backend. It is on by default in development and never active in a production build. To use a real backend set `NEXT_PUBLIC_DEMO_MODE=false` in `.env.local` and restart `npm run dev`. Demo logins: `hr@cipl.test`, `manager@cipl.test`, `employee@cipl.test`, password `password`.

## Authentication assumptions

HTTP-only cookie session. Axios uses `withCredentials: true`; no tokens are stored in browser storage. Expected endpoints: `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`. Any 401 on other calls clears cached data and redirects to `/login?expired=1`. These shapes are assumptions until the OpenAPI spec is supplied.

## Scripts

`npm run lint` · `npm run typecheck` · `npm test` · `npm run e2e` (needs `npx playwright install chromium`) · `npm run build`

## Structure

`src/app` routes (`login`, `forbidden`, `(app)` authenticated area) · `src/lib/api` API modules · `src/lib/mocks` removable dev mock · `src/lib/permissions.ts` nav + route access per role · `src/providers` query/auth · `src/components` ui, common, layout.

## Roles

HR_ADMIN, MANAGER, EMPLOYEE. `permissions.ts` drives the sidebar and shows a Forbidden view on disallowed routes. This is UX only; the backend enforces access.

## Stage 2 routes

`/dashboard` (HR metrics + charts; other roles see upcoming holidays) · `/employees`, `/employees/new`, `/employees/[id]`, `/employees/[id]/edit` (HR) · `/organization/{departments|designations|branches|shifts}` (HR) · `/holidays` (all roles; only HR can edit).

## Assumed API contract (replace with the OpenAPI spec when available)

`GET /employees?search&departmentId&designationId&branchId&status&sort&order&page&pageSize` → `{ data, meta:{page,pageSize,total,totalPages} }` with department/designation/branch/shift/manager names included; `GET|PATCH /employees/:id`; `POST /employees`; `GET|POST /{departments|designations|branches|shifts|holidays}` and `PATCH|DELETE /…/:id`; `GET /dashboard/hr`. Types live in `src/lib/api/types.ts`; request code in `src/lib/api/*`; the dev-only fake server is `src/lib/mocks/*`.

## Stage 3 routes

HR: `/attendance`, `/attendance/monthly`, `/attendance/regularizations`, `/leave`, `/leave/calendar`, `/leave/types`. Manager: `/team`, `/team/attendance`, `/team/approvals`, `/team/calendar`. Employee/Manager: `/me/attendance`, `/me/leave`, `/me/leave/apply`.

## Roles from the backend

`src/lib/api/roles.ts` maps the backend's role names onto `HR_ADMIN`, `MANAGER`, `EMPLOYEE` (case-insensitive; accepts `role`, `role.name` or `roles[]`). If the backend sends a name that is not in the table, the app shows a screen naming the unrecognised value instead of an empty menu. Add the name to the table.

## Ports

`.env.example` points to a backend on `localhost:3001`. If port 3000 is busy, Next.js moves itself to 3001; start the frontend on a free port (`npm run dev -- -p 3100`) to avoid clashing with the backend.

## Troubleshooting: "doesn't recognise the role (none)" or an empty menu

This means the app got a web page instead of API data: either demo mode is off (`NEXT_PUBLIC_DEMO_MODE=false`) or `NEXT_PUBLIC_API_URL` points at the frontend itself (Next.js moves to port 3001 when 3000 is busy, and 3001 is the default backend port). Fix the value in `.env.local` and restart the dev server.

## Stage 4 routes

HR: `/payroll`, `/payroll/[id]`, `/documents`, `/onboarding`, `/offboarding`, `/reports` (+ `/reports/attendance|leave|payroll`). Employee/Manager: `/me/payslips`, `/me/payslips/[id]`, `/me/documents`. Everyone: `/notifications` (and the bell in the top bar).

## Payroll and privacy notes

The UI only displays figures from the API; it never adds up or recalculates pay. Payroll screens are visible to HR only, payslips only to their owner. Payslip download and document view/download call the API with the session cookie and handle error bodies. In demo mode the downloaded payslip and document files are plain-text placeholders, and Excel export returns a "not available" message so the error path is visible.

## Assumed API additions (Stage 4)

`/payroll/periods[/:id[/entries]]` + `POST /payroll/periods/:id/{submit|approve|lock}`, `/me/payslips[/:id[/download]]`, `/me/documents` (multipart upload), `/documents`, `/documents/:id/{file|verify|reject}`, `/employees/:id/documents`, `/onboarding` and `/offboarding` with `POST /…/:id/items/:itemId/complete`, `/notifications` (+ `/:id/read`, `/read-all`), `/reports/{headcount|attendance|leave|payroll}` and `/…/export?format=csv|xlsx`. Shapes are in `src/lib/api/types.ts`.
