# Frontend integration contract

Base URL: `http://localhost:3001/api/v1` in development.

Swagger UI: `http://localhost:3001/api/docs`.

OpenAPI JSON: `http://localhost:3001/api/docs-json` or the generated `docs/openapi.json`.

## Fetch example

```ts
const response = await fetch(`${API}/employees?page=1&limit=20`, {
  credentials: 'include',
  headers: { Accept: 'application/json' },
});
```

For a state-changing request, add both `credentials: 'include'` and `X-CSRF-Token` from the readable `cipl_csrf` cookie. The browser must send an allowed `Origin` automatically; the backend rejects mutation requests without it.

## Standard list and error shapes

List endpoints return:

```json
{
  "items": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "pages": 0 }
}
```

Errors return:

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Invalid request",
  "details": [],
  "requestId": "..."
}
```

Use `requestId` when reporting a problem to the backend team. Decimal money fields such as `gross`, `deductions`, and `net` are strings, and date-only fields are `YYYY-MM-DD` values represented as UTC-midnight dates by PostgreSQL. Do not use JavaScript floating-point arithmetic for payroll.

## Scope rules

HR/admin users can view company records subject to permission. Managers can view direct reports. Employees can view their own profile, attendance, leave, documents, and payslips. Sensitive bank details, payroll totals, and document bytes require the corresponding explicit permission; frontend hiding is not the authorization boundary.
