// Development-only fake attendance, regularization and leave backend. It plays the role of the
// NestJS API (durations, balances, permissions), so none of this logic lives in the real UI code.
import { addDays, format, getDaysInMonth, isWeekend, parseISO } from 'date-fns';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveRequest,
  Regularization,
  RequestStatus,
  Role,
} from '../api/types';
import type { OrgRow } from '../api/crud';
import { db, nextId } from './db';
import { notify } from './notifications-store';
import { fail, ok, paginate, type MockResult } from './result';

export interface MockCtx {
  userId: string;
  role: Role;
}
type Emp = (typeof db.employees)[number];
type Day = {
  status: AttendanceStatus | null;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
};
interface LeaveRow {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: RequestStatus;
  appliedOn: string;
  reviewerComment: string | null;
}
interface RegRow {
  id: string;
  employeeId: string;
  date: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
  status: RequestStatus;
  appliedOn: string;
  reviewerComment: string | null;
}

export const leaveStore: LeaveRow[] = [];
export const regStore: RegRow[] = [];
const overrides = new Map<string, { checkIn: string; checkOut: string }>();

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const today = () => iso(new Date());
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hash = (a: number, b: number) =>
  ((Math.imul(a, 2654435761) ^ Math.imul(b, 40503)) >>> 0) % 1000;
const emp = (id: string) => db.employees.find((e) => e.id === id);
const nameOf = (list: OrgRow[], id: string) => list.find((x) => x.id === id)?.name ?? '';
const typeOf = (id: string) => db.leaveTypes.find((t) => t.id === id);
const fullName = (e: Emp) => `${e.firstName} ${e.lastName}`;
const isHoliday = (date: string) => db.holidays.some((h) => h.date === date && h.type === 'PUBLIC');

export const summarize = (statuses: (AttendanceStatus | null)[]): AttendanceSummary => {
  const s: AttendanceSummary = {
    PRESENT: 0,
    ABSENT: 0,
    HALF_DAY: 0,
    LEAVE: 0,
    HOLIDAY: 0,
    WEEKLY_OFF: 0,
  };
  statuses.forEach((x) => {
    if (x) s[x]++;
  });
  return s;
};

export function attendanceFor(e: Emp, date: string): Day {
  const none: Day = { status: null, checkIn: null, checkOut: null, workedMinutes: null };
  if (date > today() || date < e.joiningDate) return none;
  const d = parseISO(date);
  if (isWeekend(d)) return { ...none, status: 'WEEKLY_OFF' };
  if (isHoliday(date)) return { ...none, status: 'HOLIDAY' };
  if (
    leaveStore.some(
      (l) =>
        l.employeeId === e.id && l.status === 'APPROVED' && l.fromDate <= date && date <= l.toDate,
    )
  )
    return { ...none, status: 'LEAVE' };
  const ov = overrides.get(`${e.id}|${date}`);
  if (ov)
    return {
      status: 'PRESENT',
      checkIn: ov.checkIn,
      checkOut: ov.checkOut,
      workedMinutes: mins(ov.checkOut) - mins(ov.checkIn),
    };
  const h = hash(Number(e.id), d.getDate() + d.getMonth() * 31);
  if (h % 20 === 0) return { ...none, status: 'ABSENT' };
  const inM = 9 * 60 + 10 + (h % 40);
  const isToday = date === today();
  if (h % 20 === 1)
    return {
      status: 'HALF_DAY',
      checkIn: hhmm(inM),
      checkOut: isToday ? null : '13:30',
      workedMinutes: isToday ? null : 13 * 60 + 30 - inM,
    };
  const outM = 18 * 60 + (h % 45);
  return {
    status: 'PRESENT',
    checkIn: hhmm(inM),
    checkOut: isToday ? null : hhmm(outM),
    workedMinutes: isToday ? null : outM - inM,
  };
}

export function leaveDays(from: string, to: string) {
  let n = 0;
  for (let d = parseISO(from); iso(d) <= to; d = addDays(d, 1))
    if (!isWeekend(d) && !isHoliday(iso(d))) n++;
  return n;
}
function tally(empId: string, typeId: string, year: string, excludeId?: string) {
  let used = 0,
    pending = 0;
  for (const l of leaveStore) {
    if (
      l.employeeId !== empId ||
      l.leaveTypeId !== typeId ||
      l.id === excludeId ||
      !l.fromDate.startsWith(year)
    )
      continue;
    if (l.status === 'APPROVED') used += l.days;
    if (l.status === 'PENDING') pending += l.days;
  }
  return { used, pending };
}
const entitledOf = (typeId: string) => Number(typeOf(typeId)?.annualDays ?? 0);
const isPaid = (typeId: string) => typeOf(typeId)?.paid === 'PAID';

function hydrateLeave(l: LeaveRow): LeaveRequest {
  const e = emp(l.employeeId)!;
  const t = tally(l.employeeId, l.leaveTypeId, l.fromDate.slice(0, 4), l.id);
  return {
    ...l,
    employeeCode: e.employeeCode,
    employeeName: fullName(e),
    departmentName: nameOf(db.departments, e.departmentId),
    leaveTypeName: typeOf(l.leaveTypeId)?.name ?? '',
    availableBalance: isPaid(l.leaveTypeId) ? entitledOf(l.leaveTypeId) - t.used - t.pending : null,
  };
}
function hydrateReg(r: RegRow): Regularization {
  const e = emp(r.employeeId)!;
  return { ...r, employeeCode: e.employeeCode, employeeName: fullName(e) };
}

const canDecide = (ctx: MockCtx, employeeId: string) =>
  ctx.role === 'HR_ADMIN' || (ctx.role === 'MANAGER' && emp(employeeId)?.managerId === ctx.userId);
const teamIds = (ctx: MockCtx) =>
  new Set(db.employees.filter((e) => e.managerId === ctx.userId).map((e) => e.id));

export function handleAttendanceLeave(
  method: string,
  url: string,
  params: Record<string, unknown>,
  body: unknown,
  ctx: MockCtx | null,
): MockResult | null {
  const [a, b, c, d] = url.split('/').filter(Boolean);
  const s = (k: string) => (params[k] === undefined ? '' : String(params[k]));
  const b0 = (body ?? {}) as Record<string, string>;
  const need = (...roles: Role[]) =>
    !ctx
      ? fail(401, 'Not signed in.')
      : roles.includes(ctx.role)
        ? null
        : fail(403, 'You do not have permission to do this.');
  const people = (teamOf: string | null) => {
    const q = s('search').toLowerCase();
    return db.employees
      .filter(
        (e) =>
          e.status !== 'INACTIVE' &&
          (!teamOf || e.managerId === teamOf) &&
          (!s('departmentId') || e.departmentId === s('departmentId')) &&
          (!s('branchId') || e.branchId === s('branchId')) &&
          (!q || `${e.employeeCode} ${fullName(e)}`.toLowerCase().includes(q)),
      )
      .sort((x, y) => x.employeeCode.localeCompare(y.employeeCode));
  };
  const daily = (teamOf: string | null) => {
    const date = s('date') || today();
    const recs: AttendanceRecord[] = people(teamOf).map((e) => ({
      employeeId: e.id,
      employeeCode: e.employeeCode,
      employeeName: fullName(e),
      departmentName: nameOf(db.departments, e.departmentId),
      branchName: nameOf(db.branches, e.branchId),
      date,
      ...attendanceFor(e, date),
    }));
    return ok({
      ...paginate(s('status') ? recs.filter((r) => r.status === s('status')) : recs, params),
      summary: summarize(recs.map((r) => r.status)),
    });
  };

  if (a === 'attendance' && b === 'daily' && method === 'get')
    return need('HR_ADMIN') ?? daily(null);
  if (a === 'team' && b === 'attendance' && method === 'get')
    return need('MANAGER') ?? daily(ctx!.userId);
  if (a === 'attendance' && b === 'monthly' && method === 'get') {
    const denied = need('HR_ADMIN');
    if (denied) return denied;
    const month = s('month') || today().slice(0, 7);
    const dim = getDaysInMonth(parseISO(`${month}-01`));
    const pg = paginate(people(null), params);
    return ok({
      ...pg,
      month,
      daysInMonth: dim,
      data: pg.data.map((e) => ({
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: fullName(e),
        days: Array.from(
          { length: dim },
          (_, i) => attendanceFor(e, `${month}-${String(i + 1).padStart(2, '0')}`).status,
        ),
      })),
    });
  }
  if (a === 'me' && b === 'attendance' && method === 'get') {
    const denied = need('EMPLOYEE', 'MANAGER');
    if (denied) return denied;
    const month = s('month') || today().slice(0, 7);
    const e = emp(ctx!.userId)!;
    const days = Array.from({ length: getDaysInMonth(parseISO(`${month}-01`)) }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, '0')}`;
      const x = attendanceFor(e, date);
      return { date, status: x.status, checkIn: x.checkIn, checkOut: x.checkOut };
    });
    return ok({ month, days, summary: summarize(days.map((x) => x.status)) });
  }

  // Regularizations
  if (a === 'me' && b === 'regularizations') {
    const denied = need('EMPLOYEE', 'MANAGER');
    if (denied) return denied;
    if (method === 'get')
      return ok(
        regStore
          .filter((r) => r.employeeId === ctx!.userId)
          .sort((x, y) => y.appliedOn.localeCompare(x.appliedOn))
          .map(hydrateReg),
      );
    if (method === 'post') {
      if (!b0.date || b0.date > today())
        return fail(422, 'Choose a date that is today or earlier.');
      if (mins(b0.requestedCheckOut) <= mins(b0.requestedCheckIn))
        return fail(422, 'Check-out must be after check-in.');
      if (
        regStore.some(
          (r) => r.employeeId === ctx!.userId && r.date === b0.date && r.status === 'PENDING',
        )
      )
        return fail(409, 'You already have a pending request for this date.');
      const row: RegRow = {
        id: nextId(),
        employeeId: ctx!.userId,
        date: b0.date,
        requestedCheckIn: b0.requestedCheckIn,
        requestedCheckOut: b0.requestedCheckOut,
        reason: b0.reason,
        status: 'PENDING',
        appliedOn: new Date().toISOString(),
        reviewerComment: null,
      };
      regStore.push(row);
      return ok(hydrateReg(row), 201);
    }
  }
  if ((a === 'regularizations' || (a === 'team' && b === 'regularizations')) && method === 'get') {
    const denied = a === 'team' ? need('MANAGER') : need('HR_ADMIN');
    if (denied) return denied;
    const team = a === 'team' ? teamIds(ctx!) : null;
    return ok(
      regStore
        .filter(
          (r) => (!team || team.has(r.employeeId)) && (!s('status') || r.status === s('status')),
        )
        .sort((x, y) => y.appliedOn.localeCompare(x.appliedOn))
        .map(hydrateReg),
    );
  }
  if (a === 'regularizations' && method === 'post' && (c === 'approve' || c === 'reject')) {
    const denied = need('HR_ADMIN', 'MANAGER');
    if (denied) return denied;
    const r = regStore.find((x) => x.id === b);
    if (!r) return fail(404, 'Request not found.');
    if (!canDecide(ctx!, r.employeeId))
      return fail(403, 'You can only review requests from your own team.');
    if (r.status !== 'PENDING') return fail(409, 'This request has already been reviewed.');
    r.status = c === 'approve' ? 'APPROVED' : 'REJECTED';
    r.reviewerComment = b0.comment || null;
    notify(
      r.employeeId,
      c === 'approve' ? 'REGULARIZATION_APPROVED' : 'REGULARIZATION_REJECTED',
      c === 'approve' ? 'Regularization approved' : 'Regularization rejected',
      `Your attendance request for ${r.date} was ${c === 'approve' ? 'approved' : 'rejected'}.`,
      '/me/attendance',
    );
    if (c === 'approve')
      overrides.set(`${r.employeeId}|${r.date}`, {
        checkIn: r.requestedCheckIn,
        checkOut: r.requestedCheckOut,
      });
    return ok(hydrateReg(r));
  }

  // Leave
  if (a === 'me' && b === 'leave') {
    const denied = need('EMPLOYEE', 'MANAGER');
    if (denied) return denied;
    if (c === 'balances' && method === 'get') {
      const year = today().slice(0, 4);
      const balances: LeaveBalance[] = db.leaveTypes
        .filter((t) => t.paid === 'PAID')
        .map((t) => {
          const x = tally(ctx!.userId, t.id, year);
          return {
            leaveTypeId: t.id,
            leaveTypeName: t.name,
            entitled: Number(t.annualDays),
            used: x.used,
            pending: x.pending,
            available: Number(t.annualDays) - x.used - x.pending,
          };
        });
      return ok(balances);
    }
    if (!c && method === 'get')
      return ok(
        leaveStore
          .filter((l) => l.employeeId === ctx!.userId)
          .sort((x, y) => y.fromDate.localeCompare(x.fromDate))
          .map(hydrateLeave),
      );
    if (!c && method === 'post') {
      const t = typeOf(b0.leaveTypeId);
      if (!t) return fail(422, 'Choose a leave type.');
      if (!b0.fromDate || !b0.toDate || b0.toDate < b0.fromDate)
        return fail(422, 'The end date must be on or after the start date.');
      const days = leaveDays(b0.fromDate, b0.toDate);
      if (days === 0) return fail(422, 'The selected dates have no working days.');
      if (
        leaveStore.some(
          (l) =>
            l.employeeId === ctx!.userId &&
            (l.status === 'PENDING' || l.status === 'APPROVED') &&
            l.fromDate <= b0.toDate &&
            b0.fromDate <= l.toDate,
        )
      )
        return fail(409, 'You already have a leave request overlapping these dates.');
      const x = tally(ctx!.userId, t.id, b0.fromDate.slice(0, 4));
      const available = Number(t.annualDays) - x.used - x.pending;
      if (t.paid === 'PAID' && days > available)
        return fail(409, `Not enough ${t.name} balance. Available: ${available}.`);
      const row: LeaveRow = {
        id: nextId(),
        employeeId: ctx!.userId,
        leaveTypeId: t.id,
        fromDate: b0.fromDate,
        toDate: b0.toDate,
        days,
        reason: b0.reason,
        status: 'PENDING',
        appliedOn: today(),
        reviewerComment: null,
      };
      leaveStore.push(row);
      return ok(hydrateLeave(row), 201);
    }
    if (c && d === 'cancel' && method === 'post') {
      const l = leaveStore.find((x) => x.id === c && x.employeeId === ctx!.userId);
      if (!l) return fail(404, 'Request not found.');
      if (l.status !== 'PENDING') return fail(409, 'Only pending requests can be cancelled.');
      l.status = 'CANCELLED';
      return ok(null, 204);
    }
  }
  if (a === 'leave' && b === 'preview' && method === 'get') {
    const denied = need('EMPLOYEE', 'MANAGER');
    if (denied) return denied;
    const t = typeOf(s('leaveTypeId'));
    if (!t) return fail(422, 'Choose a leave type.');
    const days = leaveDays(s('fromDate'), s('toDate'));
    const x = tally(ctx!.userId, t.id, s('fromDate').slice(0, 4));
    const available = t.paid === 'PAID' ? Number(t.annualDays) - x.used - x.pending : null;
    const sufficient = days > 0 && (available === null || days <= available);
    return ok({
      days,
      available,
      sufficient,
      message:
        days === 0
          ? 'The selected dates have no working days.'
          : !sufficient
            ? `Not enough balance. You have ${available} day(s) available.`
            : null,
    });
  }
  if (
    (a === 'leave' || a === 'team') &&
    (b === 'requests' || (a === 'team' && b === 'leave' && c === 'requests')) &&
    method === 'get'
  ) {
    const denied = a === 'team' ? need('MANAGER') : need('HR_ADMIN');
    if (denied) return denied;
    const team = a === 'team' ? teamIds(ctx!) : null;
    const q = s('search').toLowerCase();
    const items = leaveStore
      .filter(
        (l) =>
          (!team || team.has(l.employeeId)) &&
          (!s('status') || l.status === s('status')) &&
          (!s('departmentId') || emp(l.employeeId)?.departmentId === s('departmentId')),
      )
      .map(hydrateLeave)
      .filter((l) => !q || `${l.employeeCode} ${l.employeeName}`.toLowerCase().includes(q))
      .sort((x, y) =>
        x.status === y.status
          ? x.fromDate.localeCompare(y.fromDate)
          : x.status === 'PENDING'
            ? -1
            : y.status === 'PENDING'
              ? 1
              : y.fromDate.localeCompare(x.fromDate),
      );
    return ok(paginate(items, params));
  }
  if (
    a === 'leave' &&
    b === 'requests' &&
    method === 'post' &&
    (d === 'approve' || d === 'reject')
  ) {
    const denied = need('HR_ADMIN', 'MANAGER');
    if (denied) return denied;
    const l = leaveStore.find((x) => x.id === c);
    if (!l) return fail(404, 'Request not found.');
    if (!canDecide(ctx!, l.employeeId))
      return fail(403, 'You can only review requests from your own team.');
    if (l.status !== 'PENDING') return fail(409, 'This request has already been reviewed.');
    if (
      d === 'approve' &&
      isPaid(l.leaveTypeId) &&
      l.days >
        entitledOf(l.leaveTypeId) -
          tally(l.employeeId, l.leaveTypeId, l.fromDate.slice(0, 4), l.id).used
    )
      return fail(409, 'The employee does not have enough balance to approve this request.');
    l.status = d === 'approve' ? 'APPROVED' : 'REJECTED';
    l.reviewerComment = b0.comment || null;
    notify(
      l.employeeId,
      d === 'approve' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      d === 'approve' ? 'Leave approved' : 'Leave rejected',
      `Your ${typeOf(l.leaveTypeId)?.name ?? 'leave'} request for ${l.fromDate} was ${d === 'approve' ? 'approved' : 'rejected'}.`,
      '/me/leave',
    );
    return ok(hydrateLeave(l));
  }
  if ((a === 'leave' && b === 'calendar') || (a === 'team' && b === 'leave' && c === 'calendar')) {
    const denied = a === 'team' ? need('MANAGER') : need('HR_ADMIN');
    if (denied) return denied;
    const team = a === 'team' ? teamIds(ctx!) : null;
    const month = s('month') || today().slice(0, 7);
    const first = `${month}-01`,
      last = `${month}-${String(getDaysInMonth(parseISO(first))).padStart(2, '0')}`;
    const entries: LeaveCalendarEntry[] = leaveStore
      .filter(
        (l) =>
          (l.status === 'APPROVED' || l.status === 'PENDING') &&
          (!team || team.has(l.employeeId)) &&
          l.fromDate <= last &&
          first <= l.toDate,
      )
      .map((l) => ({
        id: l.id,
        employeeId: l.employeeId,
        employeeName: fullName(emp(l.employeeId)!),
        leaveTypeName: typeOf(l.leaveTypeId)?.name ?? '',
        fromDate: l.fromDate,
        toDate: l.toDate,
        status: l.status,
      }));
    return ok(entries);
  }
  return null;
}

// ---- seed data ----
const wd = (offset: number) => {
  let d = addDays(new Date(), offset);
  while (isWeekend(d)) d = addDays(d, 1);
  return iso(d);
};
const span = (from: string, n: number) => {
  let d = parseISO(from);
  for (let left = n - 1; left > 0;) {
    d = addDays(d, 1);
    if (!isWeekend(d)) left--;
  }
  return iso(d);
};
function seedLeave(
  employeeId: string,
  leaveTypeId: string,
  start: number,
  n: number,
  status: RequestStatus,
  reason: string,
  comment: string | null = null,
) {
  const fromDate = wd(start),
    toDate = span(fromDate, n);
  leaveStore.push({
    id: nextId(),
    employeeId,
    leaveTypeId,
    fromDate,
    toDate,
    days: leaveDays(fromDate, toDate),
    reason,
    status,
    appliedOn: iso(addDays(new Date(), Math.min(start, 0) - 2)),
    reviewerComment: comment,
  });
}
seedLeave('7', '1', -25, 2, 'APPROVED', 'Family function');
seedLeave('7', '2', -12, 1, 'APPROVED', 'Fever');
seedLeave('7', '3', 20, 5, 'PENDING', 'Vacation');
seedLeave('13', '1', 6, 2, 'PENDING', 'Personal errand');
seedLeave('19', '2', 3, 1, 'PENDING', 'Medical appointment');
seedLeave('25', '3', 30, 4, 'PENDING', 'Travel');
seedLeave('3', '1', 8, 2, 'PENDING', 'Wedding in the family');
seedLeave('9', '1', -8, 1, 'REJECTED', 'Short notice', 'The team is short-staffed that day.');
seedLeave('14', '3', -40, 5, 'APPROVED', 'Holiday trip');
seedLeave('20', '1', -3, 1, 'APPROVED', 'Personal work');
seedLeave('43', '1', 0, 1, 'APPROVED', 'Personal work');

function seedReg(
  employeeId: string,
  offset: number,
  status: RequestStatus,
  reason: string,
  comment: string | null = null,
) {
  const date = wd(offset);
  regStore.push({
    id: nextId(),
    employeeId,
    date,
    requestedCheckIn: '09:30',
    requestedCheckOut: '18:15',
    reason,
    status,
    appliedOn: new Date(Date.now() - (30 + Math.abs(offset)) * 3600_000).toISOString(),
    reviewerComment: comment,
  });
  if (status === 'APPROVED')
    overrides.set(`${employeeId}|${date}`, { checkIn: '09:30', checkOut: '18:15' });
}
seedReg('7', -5, 'PENDING', 'Forgot to punch in; I was on a client site.');
seedReg('13', -4, 'PENDING', 'Biometric device was not working.');
seedReg('19', -6, 'PENDING', 'Worked from the Noida unit that day.');
seedReg('4', -3, 'PENDING', 'Missed the punch-out after a late meeting.');
seedReg('7', -12, 'APPROVED', 'System outage at the gate.', 'Approved.');
