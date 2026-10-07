import axios, { AxiosError } from 'axios';
import type { ApiErrorBody } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** The server answered with a web page (HTML) instead of API data, so the URL is wrong or the backend is not running. */
export class UnexpectedResponseError extends Error {
  constructor(apiUrl: string) {
    let hint = '';
    try {
      if (typeof window !== 'undefined' && new URL(apiUrl).host === window.location.host) {
        hint =
          ' The API address uses the same host and port as this website, so the app is calling itself.';
      }
    } catch {
      /* ignore malformed URLs */
    }
    super(
      `The server at ${apiUrl} returned a web page instead of data. Check that the backend is running and NEXT_PUBLIC_API_URL is correct (or use demo mode: see the README).${hint}`,
    );
  }
}

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // HTTP-only cookie session
  timeout: 15000,
});

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

const AUTH_PATHS = ['/auth/login', '/auth/me'];

apiClient.interceptors.response.use(
  (res) => {
    if (
      res.config.responseType !== 'blob' &&
      typeof res.data === 'string' &&
      /^\s*(<!doctype html|<html)/i.test(res.data)
    ) {
      throw new UnexpectedResponseError(API_URL);
    }
    return res;
  },
  (error: AxiosError<ApiErrorBody>) => {
    const url = error.config?.url ?? '';
    if (error.response?.status === 401 && !AUTH_PATHS.some((p) => url.startsWith(p))) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
  if (error instanceof UnexpectedResponseError) return error.message;
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response)
      return `Cannot reach the server at ${API_URL}. If no backend is running, use demo mode (see the README) or start the backend.`;
    const d = error.response.data?.details;
    if (Array.isArray(d) && d.length && d.every((x) => typeof x === 'string'))
      return (d as string[]).join('. ');
    const m = error.response.data?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (m) return m;
  }
  return fallback;
}
