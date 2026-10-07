/* eslint-disable @typescript-eslint/no-explicit-any */
// Talks to the real NestJS backend. Used only by the backend adapter (adapter.ts); screens never call this.
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { API_URL } from '../api/client';

/** Company timezone: attendance times are shown in it. Override with NEXT_PUBLIC_COMPANY_TZ. */
export const COMPANY_TZ = process.env.NEXT_PUBLIC_COMPANY_TZ ?? 'Asia/Kolkata';

export class BackendNotSupported extends Error {
  constructor(
    message: string,
    public readonly status = 501,
  ) {
    super(message);
  }
}

export const raw = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  // The backend sets a readable cipl_csrf cookie and requires it echoed in X-CSRF-Token on every mutation.
  xsrfCookieName: 'cipl_csrf',
  xsrfHeaderName: 'X-CSRF-Token',
  withXSRFToken: true,
});

const NO_REFRESH = ['/auth/login', '/auth/refresh'];
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  try {
    await raw.post('/auth/refresh');
    return true;
  } catch {
    return false;
  }
}

/** Sends a request; if the 15-minute access cookie has expired, rotates the session once and retries. */
export async function call<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  try {
    return await raw.request<T>(config);
  } catch (e) {
    const url = config.url ?? '';
    if (
      axios.isAxiosError(e) &&
      e.response?.status === 401 &&
      !NO_REFRESH.some((p) => url.startsWith(p))
    ) {
      refreshing ??= refreshSession().finally(() => {
        refreshing = null;
      });
      if (await refreshing) return raw.request<T>(config);
    }
    throw e;
  }
}

export type Query = Record<string, unknown> | undefined;
export const clean = (q: Query) =>
  Object.fromEntries(
    Object.entries(q ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

export const api = {
  get: async <T = any>(url: string, params?: Query): Promise<T> =>
    (await call<T>({ method: 'get', url, params: clean(params) })).data,
  post: async <T = any>(url: string, data?: unknown): Promise<T> =>
    (await call<T>({ method: 'post', url, data })).data,
  put: async <T = any>(url: string, data?: unknown): Promise<T> =>
    (await call<T>({ method: 'put', url, data })).data,
  patch: async <T = any>(url: string, data?: unknown): Promise<T> =>
    (await call<T>({ method: 'patch', url, data })).data,
  del: async <T = any>(url: string): Promise<T> => (await call<T>({ method: 'delete', url })).data,
};

interface BackendPage<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

/** Reads every page of a backend list (the API caps a page at 100 rows). */
export async function fetchAll<T = any>(url: string, params?: Query, maxPages = 30): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await api.get<BackendPage<T>>(url, { ...params, page, limit: 100 });
    out.push(...res.items);
    if (page >= res.meta.pages) break;
  }
  return out;
}

/** One screen page of a backend list, even when the screen asks for more than 100 rows. */
export async function fetchPage<T = any>(
  url: string,
  params: Query,
  page: number,
  pageSize: number,
): Promise<{ items: T[]; total: number }> {
  const start = (page - 1) * pageSize;
  const first = Math.floor(start / 100) + 1;
  const last = Math.max(first, Math.ceil((start + pageSize) / 100));
  const items: T[] = [];
  let total = 0;
  for (let p = first; p <= last; p++) {
    const res = await api.get<BackendPage<T>>(url, { ...params, page: p, limit: 100 });
    total = res.meta.total;
    items.push(...res.items);
    if (p >= res.meta.pages) break;
  }
  const offset = start - (first - 1) * 100;
  return { items: items.slice(offset, offset + pageSize), total };
}

export function paginate<T>(rows: T[], page = 1, pageSize = 10) {
  const total = rows.length;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

// ---- dates and times (company timezone) ----

const parts = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: COMPANY_TZ, ...opts }).format(d);

/** Today's date (YYYY-MM-DD) in the company timezone. */
export const todayStr = (d = new Date()) =>
  parts(d, { year: 'numeric', month: '2-digit', day: '2-digit' });

/** "09:05" for an ISO instant, in the company timezone. */
export function hhmm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: COMPANY_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** "+05:30" – the company timezone's UTC offset on the given date. */
function tzOffset(date: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone: COMPANY_TZ, timeZoneName: 'longOffset' })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return '+00:00';
  return `${m[1]}${m[2].padStart(2, '0')}:${m[3] ?? '00'}`;
}

export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Builds an ISO instant with offset from a date and an "HH:mm" time in the company timezone. */
export function toInstant(date: string, time: string): string {
  return `${date}T${time}:00${tzOffset(date)}`;
}

export const minutesToTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const lastDayOfMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};
