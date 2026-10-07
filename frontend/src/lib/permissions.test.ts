import { describe, expect, it } from 'vitest';
import { canAccess, navFor } from './permissions';

describe('role-based navigation', () => {
  it('shows payroll and organization only to HR', () => {
    const labels = (r: Parameters<typeof navFor>[0]) => navFor(r).map((i) => i.label);
    expect(labels('HR_ADMIN')).toEqual(
      expect.arrayContaining(['Payroll', 'Organization', 'Employees']),
    );
    expect(labels('MANAGER')).not.toContain('Payroll');
    expect(labels('EMPLOYEE')).not.toEqual(expect.arrayContaining(['Employees', 'Reports']));
  });
  it('gives managers team screens but not company-wide HR ones', () => {
    expect(canAccess('MANAGER', '/team/approvals')).toBe(true);
    expect(canAccess('MANAGER', '/employees')).toBe(false);
    expect(canAccess('EMPLOYEE', '/team/approvals')).toBe(false);
  });
  it('blocks employees from payroll routes but lets them see their payslips', () => {
    expect(canAccess('EMPLOYEE', '/payroll/runs')).toBe(false);
    expect(canAccess('EMPLOYEE', '/me/payslips')).toBe(true);
  });
  it('gives managers the team calendar and approvals, and HR the company leave screens', () => {
    const labels = (r: Parameters<typeof navFor>[0]) => navFor(r).map((i) => i.label);
    expect(labels('MANAGER')).toEqual(
      expect.arrayContaining(['Team Calendar', 'Approvals', 'Team Attendance']),
    );
    expect(labels('EMPLOYEE')).not.toContain('Approvals');
    expect(canAccess('HR_ADMIN', '/leave/types')).toBe(true);
    expect(canAccess('EMPLOYEE', '/leave/types')).toBe(false);
    expect(canAccess('EMPLOYEE', '/me/leave/apply')).toBe(true);
    expect(canAccess('MANAGER', '/attendance/monthly')).toBe(false);
  });
  it('keeps payroll, onboarding and report screens away from non-HR roles', () => {
    const labels = (r: Parameters<typeof navFor>[0]) => navFor(r).map((i) => i.label);
    expect(labels('HR_ADMIN')).toEqual(
      expect.arrayContaining(['Payroll', 'Onboarding', 'Offboarding', 'Reports', 'Documents']),
    );
    for (const role of ['MANAGER', 'EMPLOYEE'] as const) {
      expect(canAccess(role, '/payroll')).toBe(false);
      expect(canAccess(role, '/payroll/p-2026-09')).toBe(false);
      expect(canAccess(role, '/reports/payroll')).toBe(false);
      expect(canAccess(role, '/onboarding')).toBe(false);
      expect(canAccess(role, '/documents')).toBe(false);
    }
    expect(canAccess('EMPLOYEE', '/me/payslips/ps-2026-08')).toBe(true);
    expect(canAccess('EMPLOYEE', '/me/documents')).toBe(true);
    expect(canAccess('HR_ADMIN', '/me/payslips')).toBe(false);
  });
});
