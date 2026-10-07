# Login correction — 30 September 2026

## Apply to an existing installation

1. Stop the backend with Ctrl+C.
2. From this archive, copy these files into the matching locations in your existing project:
   - `src/prisma/prisma.service.ts`
   - `src/common/input.pipe.ts`
3. Run `npm run build`, then `npm start`.
4. Retry `POST /api/v1/auth/login` in Swagger, then `GET /api/v1/auth/me`.

The correction does not require a database migration, reseed, password reset, or volume deletion. Retain your current `.env` and Docker port mapping when applying these two source-file updates.

## What changed

The transaction helper used `$queryRaw` for `SELECT pg_advisory_xact_lock(2802026)`. PostgreSQL returns `void` for this function, which the Prisma PostgreSQL adapter cannot deserialize. This was reproduced as Prisma error P2010. The helper now uses `$executeRaw`, which performs the same lock operation without attempting to deserialize the result.

The global input safety pipe was also examining the internal principal supplied by the `CurrentUser` decorator. Admin accounts legitimately have a null employee link. The pipe now skips custom-decorator values while continuing to validate request bodies, query parameters, and route parameters.

## Verification

`npm run build` passes.

The focused regression check is available as:

```shell
node scripts/check-auth-transaction.mjs
```

It runs with an isolated in-memory PostgreSQL engine (PGlite), applies both project migrations, and uses the project seed. It does not connect to the configured application database.

Verified outcomes:

- Null input: HTTP 400.
- Incorrect password: HTTP 401, no session created.
- Correct seeded admin login: HTTP 200, three session/CSRF cookies set.
- Current admin identity: HTTP 200 with SUPER_ADMIN role.
- Login session and audit record persisted.
- Advisory lock held during the transaction and released after commit.
- A deliberately failed transaction rolled back its changes.

Redis is stubbed in this focused test. This test is not a complete Docker/Redis or production end-to-end validation.
