import { describe, expect, it } from 'vitest';
import { UnknownRoleError, normalizeRole, toCurrentUser } from './roles';

describe('role normalisation', () => {
  it('accepts the canonical names and common aliases, ignoring case', () => {
    expect(normalizeRole({ role: 'HR_ADMIN' })).toBe('HR_ADMIN');
    expect(normalizeRole({ role: 'admin' })).toBe('HR_ADMIN');
    expect(normalizeRole({ role: 'Hr' })).toBe('HR_ADMIN');
    expect(normalizeRole({ role: 'manager' })).toBe('MANAGER');
    expect(normalizeRole({ role: 'Employee' })).toBe('EMPLOYEE');
  });
  it('reads object roles and role lists, choosing the highest privilege', () => {
    expect(normalizeRole({ role: { name: 'MANAGER' } })).toBe('MANAGER');
    expect(normalizeRole({ roles: ['EMPLOYEE', 'MANAGER'] })).toBe('MANAGER');
    expect(normalizeRole({ roles: [{ name: 'employee' }, { name: 'hr' }] })).toBe('HR_ADMIN');
  });
  it('reports the raw value when the role is unknown instead of guessing', () => {
    expect(() => normalizeRole({ role: 'SUPERVISOR' })).toThrowError(UnknownRoleError);
    try {
      normalizeRole({});
    } catch (e) {
      expect((e as UnknownRoleError).rawRole).toBe('(none)');
    }
  });
  it('builds a user from wrapped or flat responses', () => {
    expect(
      toCurrentUser({ user: { id: 5, email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'hr' } }),
    ).toMatchObject({ id: '5', name: 'A B', role: 'HR_ADMIN' });
  });
});
