import { format, isAfter, parseISO, subDays, isWeekend } from 'date-fns';
import type { EmployeeInput, EmployeeListItem, HrDashboard } from '../api/types';
import type { OrgRow } from '../api/crud';
import { db, nextId } from './db';
import { fail, ok, type MockResult } from './result';
import { handleStage4 } from './stage4';
import {
  attendanceFor,
  handleAttendanceLeave,
  leaveStore,
  regStore,
  summarize,
  type MockCtx,
} from './attendance-leave';

type Collection =
  'departments' | 'designations' | 'branches' | 'shifts' | 'holidays' | 'leaveTypes';
const ROOT_TO_KEY: Record<string, Collection> = {
  departments: 'departments',
  designations: 'designations',
  branches: 'branches',
  shifts: 'shifts',
  holidays: 'holidays',
  'leave-types': 'leaveTypes',
};
const IN_USE_FIELD: Partial<Record<Collection, keyof EmployeeInput>> = {
  departments: 'departmentId',
  designations: 'designationId',
  branches: 'branchId',
  shifts: 'shiftId',
};

const nameOf = (list: OrgRow[], id: string) => list.find((x) => x.id === id)?.name ?? '';

function toListItem(e: (typeof db.employees)[number]): EmployeeListItem {
  const m = e.managerId ? db.employees.find((x) => x.id === e.managerId) : undefined;
  return {
    ...e,
    departmentName: nameOf(db.departments, e.departmentId),
    designationName: nameOf(db.designations, e.designationId),
    branchName: nameOf(db.branches, e.branchId),
    shiftName: nameOf(db.shifts, e.shiftId),
    managerName: m ? `${m.firstName} ${m.lastName}` : null,
  };
}

const SORTERS: Record<string, (e: EmployeeListItem) => string> = {
  employeeCode: (e) => e.employeeCode,
  name: (e) => `${e.firstName} ${e.lastName}`.toLowerCase(),
  department: (e) => e.departmentName,
  designation: (e) => e.designationName,
  branch: (e) => e.branchName,
  joiningDate: (e) => e.joiningDate,
  status: (e) => e.status,
};

function listEmployees(p: Record<string, unknown>): MockResult {
  const s = (k: string) => (p[k] === undefined ? '' : String(p[k]));
  const search = s('search').toLowerCase();
  let items = db.employees.map(toListItem).filter((e) => {
    if (s('departmentId') && e.departmentId !== s('departmentId')) return false;
    if (s('designationId') && e.designationId !== s('designationId')) return false;
    if (s('branchId') && e.branchId !== s('branchId')) return false;
    if (s('status') && e.status !== s('status')) return false;
    if (!search) return true;
    return [e.employeeCode, e.firstName, e.lastName, e.email].some((v) =>
      v.toLowerCase().includes(search),
    );
  });
  const sorter = SORTERS[s('sort') || 'employeeCode'] ?? SORTERS.employeeCode;
  const dir = s('order') === 'desc' ? -1 : 1;
  items = [...items].sort((a, b) => sorter(a).localeCompare(sorter(b)) * dir);
  const pageSize = Math.min(Number(s('pageSize')) || 10, 100);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Number(s('page')) || 1, 1), totalPages);
  return ok({
    data: items.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total, totalPages },
  });
}

function duplicate(input: EmployeeInput, selfId?: string) {
  const other = db.employees.find(
    (e) =>
      e.id !== selfId &&
      (e.employeeCode.toLowerCase() === input.employeeCode.toLowerCase() ||
        e.email.toLowerCase() === input.email.toLowerCase()),
  );
  if (!other) return null;
  return other.employeeCode.toLowerCase() === input.employeeCode.toLowerCase()
    ? fail(409, `Employee code ${input.employeeCode} is already in use.`)
    : fail(409, `The email ${input.email} is already registered to another employee.`);
}

function hrDashboard(): HrDashboard {
  const active = db.employees.filter((e) => e.status === 'ACTIVE');
  const today = format(new Date(), 'yyyy-MM-dd');
  const counts = (date: string) => summarize(active.map((e) => attendanceFor(e, date).status));
  const now = counts(today);
  const days: Date[] = [];
  for (let d = new Date(); days.length < 7; d = subDays(d, 1)) if (!isWeekend(d)) days.unshift(d);
  return {
    totalEmployees: db.employees.length,
    activeEmployees: active.length,
    presentToday: now.PRESENT + now.HALF_DAY,
    absentToday: now.ABSENT,
    onLeaveToday: now.LEAVE,
    newJoiners: db.employees.filter((e) =>
      isAfter(parseISO(e.joiningDate), subDays(new Date(), 30)),
    ).length,
    pendingApprovals: {
      leave: leaveStore.filter((l) => l.status === 'PENDING').length,
      regularization: regStore.filter((r) => r.status === 'PENDING').length,
    },
    departmentDistribution: db.departments.map((d) => ({
      department: d.name,
      count: db.employees.filter((e) => e.departmentId === d.id).length,
    })),
    attendanceSummary: days.map((d) => {
      const c = counts(format(d, 'yyyy-MM-dd'));
      return {
        date: format(d, 'yyyy-MM-dd'),
        present: c.PRESENT + c.HALF_DAY,
        absent: c.ABSENT,
        onLeave: c.LEAVE,
      };
    }),
    upcomingHolidays: db.holidays
      .filter((h) => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5) as unknown as HrDashboard['upcomingHolidays'],
  };
}

export function handleMock(
  method: string,
  url: string,
  params: Record<string, unknown>,
  body: unknown,
  ctx: MockCtx | null = null,
): MockResult | null {
  const delegated = handleAttendanceLeave(method, url, params, body, ctx);
  if (delegated) return delegated;
  const stage4 = handleStage4(method, url, params, body, ctx);
  if (stage4) return stage4;

  const [, root, id] = url.split('/');
  const b = (body ?? {}) as Record<string, string>;

  if (root === 'dashboard' && id === 'hr' && method === 'get') return ok(hrDashboard());

  if (root === 'team' && id === 'members' && method === 'get') {
    if (!ctx || ctx.role !== 'MANAGER') return fail(403, 'You do not have permission to do this.');
    const t = format(new Date(), 'yyyy-MM-dd');
    return ok(
      db.employees
        .filter((e) => e.managerId === ctx.userId && e.status !== 'INACTIVE')
        .sort((x, y) => x.employeeCode.localeCompare(y.employeeCode))
        .map((e) => ({ ...toListItem(e), todayStatus: attendanceFor(e, t).status })),
    );
  }

  if (root === 'employees') {
    if (!id && method === 'get') return listEmployees(params);
    if (!id && method === 'post') {
      const input = body as EmployeeInput;
      const dup = duplicate(input);
      if (dup) return dup;
      const created = { ...input, id: nextId() };
      db.employees.push(created);
      return ok(created, 201);
    }
    const found = db.employees.find((e) => e.id === id);
    if (!found) return fail(404, 'Employee not found.');
    if (method === 'get') return ok(toListItem(found));
    if (method === 'patch') {
      const input = body as EmployeeInput;
      const dup = duplicate(input, found.id);
      if (dup) return dup;
      Object.assign(found, input);
      return ok(found);
    }
  }

  const key = ROOT_TO_KEY[root];
  if (key) {
    const list = db[key];
    if (!id && method === 'get') return ok(list);
    if (!id && method === 'post') {
      const row = { ...b, id: nextId() } as OrgRow;
      list.push(row);
      return ok(row, 201);
    }
    const row = list.find((r) => r.id === id);
    if (!row) return fail(404, 'Record not found.');
    if (method === 'patch') return ok(Object.assign(row, b));
    if (method === 'delete') {
      if (key === 'leaveTypes') {
        const n = leaveStore.filter((l) => l.leaveTypeId === row.id).length;
        if (n > 0) return fail(409, `Can’t delete ${row.name}: ${n} leave requests use it.`);
      } else {
        const field = IN_USE_FIELD[key];
        const used = field ? db.employees.filter((e) => e[field] === row.id).length : 0;
        if (used > 0)
          return fail(409, `Can’t delete ${row.name}: ${used} employees are assigned to it.`);
      }
      list.splice(list.indexOf(row), 1);
      return ok(null, 204);
    }
  }
  return null;
}
