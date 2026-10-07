import { afterEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter } from 'axios';
import { apiClient, getErrorMessage, UnexpectedResponseError } from './client';
import { authApi } from './auth';
import { UnknownRoleError, toCurrentUser } from './roles';

const original = apiClient.defaults.adapter;
afterEach(() => {
  apiClient.defaults.adapter = original;
});

const respondWith =
  (data: unknown): AxiosAdapter =>
  async (config) => ({ data, status: 200, statusText: 'OK', headers: {}, config });

describe('unexpected API responses', () => {
  it('rejects an HTML page returned in place of JSON and explains what to check', async () => {
    apiClient.defaults.adapter = respondWith('<!DOCTYPE html><html><body>App</body></html>');
    const err = await authApi.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnexpectedResponseError);
    expect(getErrorMessage(err)).toMatch(/NEXT_PUBLIC_API_URL/);
  });
});

describe('user response shapes', () => {
  it('unwraps { data: { user } } and { data } envelopes', () => {
    expect(
      toCurrentUser({ success: true, data: { user: { id: 1, email: 'a@b.c', role: 'manager' } } })
        .role,
    ).toBe('MANAGER');
    expect(toCurrentUser({ data: { id: 2, email: 'a@b.c', roles: ['EMPLOYEE'] } }).role).toBe(
      'EMPLOYEE',
    );
  });
  it('names the fields it received when no role is present', () => {
    try {
      toCurrentUser({ id: 1, email: 'a@b.c' });
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownRoleError);
      expect((e as UnknownRoleError).fields).toEqual(['id', 'email']);
    }
  });
});
