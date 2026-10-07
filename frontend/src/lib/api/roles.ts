import type { CurrentUser, Role } from './types';

/**
 * Maps whatever the backend calls a role onto the three roles the UI understands.
 * Edit this table if the NestJS API uses different role names. The UI uses it only to
 * decide what to show; the backend still enforces every permission.
 */
const ALIASES: Record<string, Role> = {
  HR_ADMIN: 'HR_ADMIN',
  SUPER_ADMIN: 'HR_ADMIN',
  HR_EXECUTIVE: 'HR_ADMIN',
  HR: 'HR_ADMIN',
  ADMIN: 'HR_ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  STAFF: 'EMPLOYEE',
};
const PRIORITY: Role[] = ['HR_ADMIN', 'MANAGER', 'EMPLOYEE'];

export class UnknownRoleError extends Error {
  constructor(
    public readonly rawRole: string,
    public readonly fields: string[] = [],
  ) {
    super(`Unrecognised role: ${rawRole}`);
  }
}

const asText = (v: unknown): string | null => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return asText(o.name ?? o.code ?? o.key ?? null);
  }
  return null;
};

/** Accepts `role: "HR"`, `role: { name: "HR" }`, or `roles: ["HR", ...]` (highest privilege wins). */
export function normalizeRole(raw: Record<string, unknown>): Role {
  const candidates = (Array.isArray(raw.roles) ? raw.roles : [raw.role])
    .map(asText)
    .filter((x): x is string => !!x);
  const mapped = candidates
    .map(
      (c) =>
        ALIASES[
          c
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, '_')
        ],
    )
    .filter((r): r is Role => !!r);
  const best = PRIORITY.find((r) => mapped.includes(r));
  if (!best) throw new UnknownRoleError(candidates.join(', ') || '(none)', Object.keys(raw));
  return best;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const looksLikeUser = (o: unknown): o is Record<string, unknown> =>
  isObject(o) && ('role' in o || 'roles' in o || 'email' in o || 'id' in o);

/** Finds the user object whether the API returns it bare or wrapped as `{ user }`, `{ data }` or `{ data: { user } }`. */
function unwrapUser(raw: unknown): Record<string, unknown> {
  if (!isObject(raw)) throw new UnknownRoleError('(none)', []);
  const data = raw.data;
  const found = [
    raw.user,
    isObject(data) ? data.user : undefined,
    data,
    raw.profile,
    raw.result,
  ].find(looksLikeUser);
  return found ?? raw;
}

export function toCurrentUser(raw: unknown): CurrentUser {
  const user = unwrapUser(raw);
  const name =
    asText(user.name) ?? [asText(user.firstName), asText(user.lastName)].filter(Boolean).join(' ');
  return {
    id: String(user.id ?? ''),
    employeeCode: asText(user.employeeCode) ?? '',
    name: name || asText(user.email) || 'User',
    email: asText(user.email) ?? '',
    role: normalizeRole(user),
  };
}
