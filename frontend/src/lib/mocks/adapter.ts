// Development-only mock layer at the network boundary. Removing this folder and the
// installMocks() call in providers/query-provider.tsx leaves production code untouched.
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { apiClient } from '../api/client';
import type { CurrentUser } from '../api/types';
import { db } from './db';
import { handleMock } from './routes';

const emp = (id: string) => db.employees.find((e) => e.id === id)!;
const asUser = (id: string, role: CurrentUser['role'], email: string): CurrentUser => ({
  id,
  role,
  email,
  employeeCode: emp(id).employeeCode,
  name: `${emp(id).firstName} ${emp(id).lastName}`,
});
// Session user ids are employee ids so team/self-service mock data lines up.
const USERS: Record<string, CurrentUser> = {
  'hr@cipl.test': asUser('2', 'HR_ADMIN', 'hr@cipl.test'),
  'manager@cipl.test': asUser('1', 'MANAGER', 'manager@cipl.test'),
  'employee@cipl.test': asUser('7', 'EMPLOYEE', 'employee@cipl.test'),
};
const KEY = 'cipl-mock-session'; // dev mock only; the real API uses HTTP-only cookies

function respond(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  const res: AxiosResponse = { data, status, statusText: String(status), headers, config };
  if (status >= 400) {
    throw new AxiosError(`Request failed ${status}`, String(status), config, null, res);
  }
  return Promise.resolve(res);
}

const adapter: AxiosAdapter = async (config) => {
  const url = config.url ?? '';
  const method = (config.method ?? 'get').toLowerCase();
  if (process.env.NODE_ENV !== 'test') await new Promise((r) => setTimeout(r, 250));
  if (url === '/auth/login' && method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const user = USERS[String(body.email).toLowerCase()];
    if (!user || body.password !== 'password') {
      return respond(config, 401, { message: 'Invalid email or password.' });
    }
    sessionStorage.setItem(KEY, user.email);
    return respond(config, 200, user);
  }
  if (url === '/auth/me') {
    const email = sessionStorage.getItem(KEY);
    return email && USERS[email]
      ? respond(config, 200, USERS[email])
      : respond(config, 401, { message: 'Not signed in.' });
  }
  if (url === '/auth/logout') {
    sessionStorage.removeItem(KEY);
    return respond(config, 204, null);
  }
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  const email = sessionStorage.getItem(KEY);
  const me = email ? USERS[email] : undefined;
  const ctx = me ? { userId: me.id, role: me.role } : null;
  const result = handleMock(
    method,
    url,
    (config.params ?? {}) as Record<string, unknown>,
    body,
    ctx,
  );
  if (result) return respond(config, result.status, result.data, result.headers);
  return respond(config, 404, { message: `No mock for ${method.toUpperCase()} ${url}` });
};

/** Test helper: pretend the given mock user is signed in. */
export function mockSignIn(email: string) {
  sessionStorage.setItem(KEY, email);
}

export function installMocks() {
  apiClient.defaults.adapter = adapter;
}
