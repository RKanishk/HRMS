# CIPL HRMS engineering report

## Implemented

The repository contains a modular NestJS monolith with PostgreSQL/Prisma persistence, Redis/BullMQ notifications, secure HTTP-only cookie sessions, CSRF and origin checks, RBAC, employee/organization masters, attendance and biometric imports, regularization, configurable leave, decimal payroll, payslips, encrypted documents, onboarding/offboarding, reports, CSV export, health probes, audit logging, Docker Compose, Swagger/OpenAPI, seed data, and tests.

## Verification executed

| Check                    | Result                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ |
| Node runtime             | Passed on Node v24.19.0                                                        |
| Dependency installation  | Passed with `npm ci`/`npm install`                                             |
| Prisma schema validation | Passed with `npm run db:validate`                                              |
| Prisma client generation | Passed with `npm run db:generate`                                              |
| Prisma migrations        | Applied successfully to the local PostgreSQL-compatible PGlite socket database |
| TypeScript typecheck     | Passed with `npm run typecheck`                                                |
| Production compilation   | Passed with `npm run build`                                                    |
| ESLint                   | Passed with `npm run lint`                                                     |
| Prettier                 | Passed with `npm run format:check`                                             |
| Unit tests               | 17 passed in 1 suite                                                           |
| OpenAPI export           | Passed; 80 paths and 118 response schemas written to `docs/openapi.json`       |

## Test coverage

The executed unit suite covers full/half/absent/leave/holiday/weekly-off attendance, late/early/overtime, overnight and open punches, invalid punch sequences, exact Decimal payroll, loss-of-pay, calendar-day proration, percentage caps, invalid payroll inputs, AES-256-GCM tamper detection, token hashing, document signatures, and spreadsheet formula injection.

The repository also contains Supertest E2E coverage for public health, unauthenticated access, login/current-user, CSRF enforcement, admin organization creation, employee scoping, and RBAC denial. The final E2E run requires a live service pair.

## Environment limitations during this run

- The workspace did not provide an accessible Docker daemon, so `docker compose up --build` could not be executed here. The Compose file, Dockerfile, health checks, migration job, and dependency wiring are included for a normal Docker host.
- Native PostgreSQL and Redis service startup was blocked by the workspace approval reviewer during the final live-service pass. PostgreSQL migrations were successfully exercised earlier through the PGlite PostgreSQL wire-protocol development service; unit, build, lint, schema, and OpenAPI checks were rerun after final formatting.
- Development defaults use encrypted local file storage and a local email adapter. Production configuration rejects local email delivery and insecure cookies; the storage provider is intentionally abstracted for S3/Azure Blob replacement.

These are execution-environment limitations, not intentionally skipped core implementations. No known TypeScript, lint, build, schema, or unit-test errors remain.
