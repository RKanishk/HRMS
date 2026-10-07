# CIPL HRMS backend

Production-oriented modular monolith for CIPL's internal HRMS (approximately 280 employees). It exposes a versioned REST API for a Next.js frontend and uses PostgreSQL, Prisma, Redis, BullMQ, NestJS, TypeScript, and secure cookie sessions.

## What is included

- Cookie-based login, refresh rotation, logout, password change/reset architecture, CSRF protection, rate limiting, Helmet, CORS, input validation, and environment validation.
- Backend-enforced RBAC with `SUPER_ADMIN`, `HR_ADMIN`, `HR_EXECUTIVE`, `MANAGER`, and `EMPLOYEE` roles plus granular permissions.
- Employees, reporting hierarchy, departments, designations, branches, shifts, holidays, personal data, encrypted bank details, documents, and append-only employee history.
- Immutable raw punches, calculated attendance, CSV biometric import, check-in/out, regularization approval, late/early/overtime calculations, and leave integration.
- Configurable leave types/policies/balances with reserved balances, overlap checks, transactions, manager/HR approval, and attendance integration.
- Versioned decimal salary structures, payroll inputs, completed-month payroll processing, LOP, statutory-component configuration, independent approval, locking, payslip snapshots, and print-ready HTML output.
- Encrypted local document storage behind an object-storage abstraction, onboarding/offboarding checklists, in-app notifications, encrypted email outbox, BullMQ worker, reports, spreadsheet-safe CSV export, audit logs, health probes, and OpenAPI.

## Requirements

- Node.js 24.15+ (the repository is tested on Node 24.19)
- Docker and Docker Compose for the normal deployment path
- PostgreSQL 17 and Redis 7 when running services outside Docker

## Local setup

```bash
cp .env.example .env
# Replace DATA_ENCRYPTION_KEY with: openssl rand -hex 32
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm run db:seed
npm run start:prod
```

The API listens on `http://localhost:3001`, the REST base is `http://localhost:3001/api/v1`, Swagger UI is `http://localhost:3001/api/docs`, and the raw OpenAPI document is `http://localhost:3001/api/docs-json`.

## Docker Compose

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD and DATA_ENCRYPTION_KEY in .env
docker compose up --build
```

Compose starts PostgreSQL, Redis, a migration job, and the backend. The database and Redis are bound to loopback by default. The backend persists local development files in a named volume; replace the `ObjectStorage` provider with S3/Azure Blob in production.

## Environment

`DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL`, `CORS_ORIGINS`, `DATA_ENCRYPTION_KEY`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `ACCESS_TTL_MINUTES`, `REFRESH_TTL_DAYS`, `STORAGE_PATH`, and the email settings are documented in `.env.example`. Production validation rejects insecure cookies and local email delivery.

## Authentication contract

1. Send `POST /api/v1/auth/login` with `{ "email": "...", "password": "..." }` and the frontend's allowed `Origin` header.
2. The response sets `cipl_access`, `cipl_refresh`, and readable `cipl_csrf` cookies. Keep credentials enabled in `fetch`/Axios.
3. Send `X-CSRF-Token` equal to the `cipl_csrf` cookie for every state-changing request, plus an allowed `Origin` header. `GET` requests do not need CSRF.
4. Access tokens are short-lived. Call `POST /api/v1/auth/refresh` with the refresh cookie and CSRF header to rotate the session.
5. `GET /api/v1/auth/me` returns the effective roles and permission codes. Passwords, access tokens, refresh tokens, and encryption material are never returned.

## Database lifecycle

```bash
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:seed                 # development only
```

The seed creates clearly marked local accounts, organization masters, 20 employees, attendance samples, leave policies/balances, holidays, and a salary structure. Set `SEED_PASSWORD` to choose a local password. Default seed accounts are `admin@cipl.example` and `hr@cipl.example`; their default local password is `SeedOnly!Cipl2026`. Never use these credentials outside development.

## Testing and quality checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:e2e
npm run build
npm run openapi:export
```

The unit suite covers attendance edge cases, overnight shifts, decimal payroll arithmetic, LOP, encryption/tamper detection, file signatures, and CSV formula injection. E2E tests require PostgreSQL, Redis, migrations, and the local seed. `scripts/with-local-services.mjs` can start the embedded PostgreSQL-compatible development service and Redis for an isolated local run where native services are unavailable; production remains PostgreSQL + Redis.

## API modules

| Module         | Base path                                                            | Main capabilities                              |
| -------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| Auth           | `/auth`                                                              | Sessions, refresh, password workflows          |
| Users/Roles    | `/users`, `/roles`, `/permissions`                                   | Account administration and RBAC                |
| Organization   | `/branches`, `/departments`, `/designations`, `/shifts`, `/holidays` | Organization masters                           |
| Employees      | `/employees`                                                         | Scoped employee CRUD and private profile data  |
| Attendance     | `/attendance`                                                        | Punches, calculation, imports, regularization  |
| Leave          | `/leave`                                                             | Types, policies, balances, requests, approvals |
| Salary/Payroll | `/salary`, `/payroll`, `/payslips`                                   | Versioned rules, runs, lock, payslips          |
| Documents      | `/documents`                                                         | Authorized encrypted uploads/downloads         |
| Lifecycle      | `/onboarding`, `/offboarding`                                        | Checklists and account lifecycle               |
| Notifications  | `/notifications`                                                     | In-app notifications                           |
| Reports/Audit  | `/reports`, `/audit`                                                 | Summaries, safe CSV export, audit search       |
| Health         | `/health`                                                            | Liveness/readiness probes                      |

## Security and audit notes

Authorization is evaluated on the backend for every protected action. Managers are scoped to direct reports, employees to their own private records, and HR/admin roles to company records. Bank data is AES-256-GCM encrypted at rest and only masked values are returned. Documents are content-sniffed, size limited, encrypted locally, authorized by employee scope, integrity checked on download, and soft archived. Important state changes run in transactions and write audit events; passwords, tokens, and sensitive ciphertext are redacted from audit metadata. PostgreSQL constraints and triggers protect non-negative leave/payroll data, append-only audit/raw punch history, and locked payroll immutability.

## Frontend integration

The frontend should use the generated `docs/openapi.json` or `/api/docs-json` to generate types. Treat dates as ISO date strings and monetary values as decimal strings. Do not expose Prisma/database objects directly in the UI; use the documented endpoint response shapes. Configure the backend `FRONTEND_URL`/`CORS_ORIGINS` to the exact Next.js origin and send credentials on requests.

See `docs/architecture.md` and `docs/frontend-integration.md` for the integration contract and operational notes.
