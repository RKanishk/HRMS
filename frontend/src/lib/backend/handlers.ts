// Translates the screens' API contract (src/lib/api/*) into the real backend's endpoints and shapes.
// Each handler receives the request the screen made and returns what the screen expects.
import { normalizeRole } from '../api/roles';
import type {
  AppNotification,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  ChecklistProcess,
  EmployeeDocument,
  EmployeeInput,
  EmployeeListItem,
  LeaveRequest,
  NotificationType,
  PayBreakdown,
  PayrollEntry,
  PayrollPeriod,
  ReportResponse,
  RequestStatus,
  Regularization,
  Role,
} from '../api/types';
import {
  BackendNotSupported,
  addDays,
  api,
  call,
  fetchAll,
  fetchPage,
  hhmm,
  lastDayOfMonth,
  minutesToTime,
  paginate,
  timeToMinutes,
  todayStr,
  toInstant,
} from './http';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
export interface Req {
  method: string;
  query: Row;
  body: any;
  match: string[];
  responseType?: string;
}
/** Wraps a handler result that needs a specific status code or headers (anything else is sent as 200 JSON). */
export class Res {
  constructor(
    public data: unknown,
    public status = 200,
    public headers: Record<string, string> = {},
  ) {}
}
const out = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Res(data, status, headers);
type Handler = (r: Req) => Promise<unknown>;

const day = (v?: string | null) => (v ? String(v).slice(0, 10) : '');
const num = (v: unknown) => Number(v ?? 0);
const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const sumMoney = (values: unknown[]) => values.reduce<number>((a, v) => a + cents(v), 0) / 100;
const bad = (message: string) => new BackendNotSupported(message, 400);
const fullName = (e?: { firstName?: string; lastName?: string } | null) =>
  e ? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() : '';
const ym = (p: Row) => `${p.year}-${String(p.month).padStart(2, '0')}`;

/* ----------------------------- session & caches ----------------------------- */

interface Me {
  userId: string;
  employeeId: string | null;
  email: string;
  roles: string[];
  permissions: string[];
  name: string;
  employeeCode: string;
  role: Role;
}
let meCache: Me | null = null;
let empCache: { at: number; rows: Row[] } | null = null;

export function resetSession() {
  meCache = null;
  empCache = null;
}
const invalidateEmployees = () => {
  empCache = null;
};

async function loadMe(force = false): Promise<Me> {
  if (meCache && !force) return meCache;
  const m = await api.get('/auth/me');
  const emp = m.employeeId ? await api.get(`/employees/${m.employeeId}`) : null;
  const role = normalizeRole({ roles: m.roles });
  meCache = {
    userId: m.id,
    employeeId: m.employeeId ?? null,
    email: m.email,
    roles: m.roles,
    permissions: m.permissions,
    name: emp ? fullName(emp) : String(m.email).split('@')[0],
    employeeCode: emp?.employeeCode ?? '',
    role,
  };
  return meCache;
}

async function employees(): Promise<Row[]> {
  if (empCache && Date.now() - empCache.at < 15_000) return empCache.rows;
  const rows = await fetchAll('/employees', { sortBy: 'employeeCode', sortOrder: 'asc' });
  empCache = { at: Date.now(), rows };
  return rows;
}
const empIndex = async () => new Map((await employees()).map((e) => [e.id as string, e]));
const isWorking = (e: Row) => ['ACTIVE', 'NOTICE_PERIOD'].includes(e.status);
const requireEmployee = (me: Me) => {
  if (!me.employeeId) throw bad('This account is not linked to an employee profile.');
  return me.employeeId;
};
async function teamIds(me: Me) {
  return new Set((await employees()).filter((e) => e.managerId === me.employeeId).map((e) => e.id));
}

/* --------------------------------- mappers --------------------------------- */

const STATUS_FROM: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  NOTICE_PERIOD: 'ON_NOTICE',
  INACTIVE: 'INACTIVE',
  RESIGNED: 'INACTIVE',
  TERMINATED: 'INACTIVE',
};
const gender = (g?: string | null): EmployeeInput['gender'] => {
  const u = String(g ?? '').toUpperCase();
  return u === 'MALE' || u === 'FEMALE' ? u : 'OTHER';
};

function toEmployee(e: Row, profile?: Row | null): EmployeeListItem {
  const addr =
    profile?.addresses?.find((a: Row) => a.type === 'CURRENT') ?? profile?.addresses?.[0];
  const contact = profile?.emergencyContacts?.at(-1);
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone ?? '',
    dateOfBirth: day(profile?.personal?.dateOfBirth),
    gender: gender(profile?.personal?.gender),
    departmentId: e.departmentId,
    designationId: e.designationId,
    branchId: e.branchId,
    shiftId: e.shiftId,
    managerId: e.managerId ?? null,
    joiningDate: day(e.joiningDate),
    status: (STATUS_FROM[e.status] ?? 'INACTIVE') as EmployeeListItem['status'],
    address: addr ? [addr.line1, addr.city, addr.state, addr.postalCode].join(', ') : '',
    emergencyContactName: contact?.name ?? '',
    emergencyContactPhone: contact?.phone ?? '',
    departmentName: e.department?.name ?? '',
    designationName: e.designation?.name ?? '',
    branchName: e.branch?.name ?? '',
    shiftName: e.shift?.name ?? '',
    managerName: e.manager ? fullName(e.manager) : null,
  };
}

const emptySummary = (): AttendanceSummary => ({
  PRESENT: 0,
  ABSENT: 0,
  HALF_DAY: 0,
  LEAVE: 0,
  HOLIDAY: 0,
  WEEKLY_OFF: 0,
});

function toAttendanceRecord(e: Row, a: Row | undefined, date: string): AttendanceRecord {
  return {
    employeeId: e.id,
    employeeCode: e.employeeCode,
    employeeName: fullName(e),
    departmentName: e.department?.name ?? '',
    branchName: e.branch?.name ?? '',
    date,
    status: (a?.status as AttendanceStatus) ?? null,
    checkIn: hhmm(a?.checkIn),
    checkOut: hhmm(a?.checkOut),
    workedMinutes: a ? num(a.workingMinutes) : null,
  };
}

function toRegularization(r: Row, e?: Row): Regularization {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeCode: e?.employeeCode ?? '',
    employeeName: fullName(e),
    date: day(r.date),
    requestedCheckIn: hhmm(r.checkIn) ?? '',
    requestedCheckOut: hhmm(r.checkOut) ?? '',
    reason: r.reason,
    status: r.status as RequestStatus,
    appliedOn: day(r.createdAt),
    reviewerComment: r.reviewNote ?? null,
  };
}

function toLeaveRequest(r: Row, e?: Row): LeaveRequest {
  const note = [...(r.approvals ?? [])].reverse().find((a: Row) => a.note)?.note ?? null;
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeCode: e?.employeeCode ?? '',
    employeeName: fullName(e),
    departmentName: e?.department?.name ?? '',
    leaveTypeId: r.leaveTypeId,
    leaveTypeName: r.leaveType?.name ?? '',
    fromDate: day(r.startDate),
    toDate: day(r.endDate),
    days: num(r.days),
    reason: r.reason,
    status: r.status as RequestStatus,
    appliedOn: day(r.createdAt),
    reviewerComment: note,
    availableBalance: null,
  };
}

const RUN_STATUS: Record<string, PayrollPeriod['status']> = {
  OPEN: 'DRAFT',
  CALCULATING: 'DRAFT',
  REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
};
const STATUTORY = new Set(['PF', 'EPF', 'ESI', 'TDS', 'PT', 'LWF']);

function toBreakdown(pe: Row): PayBreakdown {
  const comps: Row[] = pe.components ?? [];
  const amount = (c: Row) => c.amount;
  const earnings = comps.filter((c) => c.kind === 'EARNING');
  const pick = (code: string) => sumMoney(earnings.filter((c) => c.code === code).map(amount));
  const deductions = comps.filter((c) => c.kind === 'DEDUCTION');
  const line = (c: Row) => ({ label: c.name, amount: num(c.amount) });
  return {
    basic: pick('BASIC'),
    allowances: sumMoney(
      earnings.filter((c) => !['BASIC', 'BONUS', 'OVERTIME'].includes(c.code)).map(amount),
    ),
    bonus: pick('BONUS'),
    overtime: pick('OVERTIME'),
    gross: num(pe.gross),
    lopDays: num(pe.lopDays),
    lopDeduction: sumMoney(deductions.filter((c) => c.code === 'LOP').map(amount)),
    statutory: deductions.filter((c) => STATUTORY.has(c.code)).map(line),
    otherDeductions: deductions.filter((c) => c.code !== 'LOP' && !STATUTORY.has(c.code)).map(line),
    totalDeductions: num(pe.deductions),
    net: num(pe.net),
  };
}

const DOC_FROM: Record<string, EmployeeDocument['documentType']> = {
  IDENTITY: 'ID_PROOF',
  CERTIFICATE: 'EDUCATION',
  EXPERIENCE: 'EXPERIENCE',
  OFFER: 'OFFER_LETTER',
  APPOINTMENT: 'OFFER_LETTER',
  RESUME: 'OTHER',
  OTHER: 'OTHER',
};
const DOC_TO: Record<string, string> = {
  ID_PROOF: 'IDENTITY',
  ADDRESS_PROOF: 'OTHER',
  EDUCATION: 'CERTIFICATE',
  EXPERIENCE: 'EXPERIENCE',
  OFFER_LETTER: 'OFFER',
  OTHER: 'OTHER',
};
function toDocument(d: Row, e?: Row): EmployeeDocument {
  return {
    id: d.id,
    employeeId: d.employeeId,
    employeeCode: e?.employeeCode ?? '',
    employeeName: fullName(e),
    documentType: DOC_FROM[d.category] ?? 'OTHER',
    fileName: d.originalName,
    sizeBytes: num(d.size),
    mimeType: d.mimeType,
    uploadedAt: d.createdAt,
    // The backend validates and encrypts uploads but has no review workflow, so nothing is ever "verified".
    status: 'PENDING',
    reviewerComment: null,
  };
}

function toProcess(c: Row, e?: Row): ChecklistProcess {
  return {
    id: c.id,
    kind: c.kind,
    employeeId: c.employeeId,
    employeeCode: e?.employeeCode ?? '',
    employeeName: fullName(e),
    departmentName: e?.department?.name ?? '',
    designationName: e?.designation?.name ?? '',
    startDate: day(c.createdAt),
    resignationDate: c.resignationDate ? day(c.resignationDate) : null,
    lastWorkingDay: c.lastWorkingDate ? day(c.lastWorkingDate) : null,
    status: c.status === 'OPEN' ? 'IN_PROGRESS' : 'COMPLETED',
    items: (c.tasks ?? []).map((t: Row) => ({
      id: t.id,
      title: t.label,
      owner: 'HR',
      dueDate: null,
      done: !!t.completed,
    })),
  };
}

/* ---------------------------------- auth ---------------------------------- */

function currentUser(me: Me) {
  return {
    id: me.employeeId ?? me.userId,
    employeeCode: me.employeeCode,
    name: me.name,
    email: me.email,
    roles: me.roles,
  };
}

const login: Handler = async ({ body }) => {
  resetSession();
  await api.post('/auth/login', { email: body?.email, password: body?.password });
  return currentUser(await loadMe(true));
};
const whoami: Handler = async () => currentUser(await loadMe(true));
const logout: Handler = async () => {
  try {
    await api.post('/auth/logout');
  } catch {
    /* already signed out */
  }
  resetSession();
  return out(null, 204);
};

/* ------------------------------- organization ------------------------------- */

const deriveCode = (name: string) => {
  const c = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return c.length >= 2 ? c : `${c}X`.padEnd(2, 'X');
};
const codeOf = (b: Row) =>
  b.code ? String(b.code).trim().toUpperCase() : deriveCode(String(b.name));

function masterHandlers(
  base: '/departments' | '/designations' | '/branches',
  shape: (r: Row) => Row,
  toBody: (b: Row) => Row,
): [string, RegExp, Handler][] {
  const path = base.slice(1);
  return [
    [
      'get',
      new RegExp(`^/${path}$`),
      async () => (await fetchAll(base)).filter((r) => r.active).map(shape),
    ],
    [
      'post',
      new RegExp(`^/${path}$`),
      async ({ body }) => out(shape(await api.post(base, toBody(body))), 201),
    ],
    [
      'patch',
      new RegExp(`^/${path}/([^/]+)$`),
      async ({ match, body }) => shape(await api.patch(`${base}/${match[0]}`, toBody(body))),
    ],
    [
      'delete',
      new RegExp(`^/${path}/([^/]+)$`),
      async ({ match }) => {
        await api.patch(`${base}/${match[0]}`, { active: false });
        return out(null, 204);
      },
    ],
  ];
}

const compact = (o: Row) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const shiftShape = (s: Row) => ({
  id: s.id,
  name: s.name,
  startTime: minutesToTime(s.startMinute),
  endTime: minutesToTime(s.endMinute),
});
const shiftBody = (b: Row) =>
  compact({
    name: b.name,
    startMinute: b.startTime ? timeToMinutes(b.startTime) : undefined,
    endMinute: b.endTime ? timeToMinutes(b.endTime) : undefined,
  });
const holidayShape = (h: Row) => ({ id: h.id, name: h.name, date: day(h.date), type: 'PUBLIC' });

const currentYear = () => Number(todayStr().slice(0, 4));
const leaveTypeShape = (t: Row) => {
  const policies: Row[] = t.policies ?? [];
  const p =
    policies.find((x) => x.year === currentYear()) ??
    [...policies].sort((a, b) => b.year - a.year)[0];
  return {
    id: t.id,
    name: t.name,
    code: t.code,
    annualDays: p ? String(num(p.annualEntitlement)) : '0',
    paid: t.paid ? 'PAID' : 'UNPAID',
  };
};
async function setEntitlement(typeId: string, days: unknown) {
  if (days === undefined || days === '') return;
  try {
    await api.post('/leave/policies', {
      leaveTypeId: typeId,
      year: currentYear(),
      annualEntitlement: String(days),
    });
  } catch (e: any) {
    if (e?.response?.status === 409)
      throw new BackendNotSupported(
        `The ${currentYear()} entitlement for this leave type is already set and can’t be changed.`,
        409,
      );
    throw e;
  }
}
const leaveTypeBody = (b: Row) =>
  compact({
    name: b.name,
    code: b.code ? String(b.code).toUpperCase() : undefined,
    paid: b.paid === undefined ? undefined : b.paid === 'PAID',
  });
async function leaveTypeById(id: string) {
  const all = await api.get('/leave/types');
  return leaveTypeShape(all.items.find((t: Row) => t.id === id));
}

/* -------------------------------- employees -------------------------------- */

const EMP_SORT: Record<string, string> = {
  employeeCode: 'employeeCode',
  name: 'firstName',
  joiningDate: 'joiningDate',
  status: 'status',
};

async function profileOf(id: string): Promise<Row | null> {
  try {
    return await api.get(`/employees/${id}/personal`);
  } catch {
    return null; // managers cannot read their reports' private profile
  }
}

function parseAddress(text: string) {
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const postal = parts.at(-1)?.toUpperCase() ?? '';
  if (parts.length < 4 || !/^[A-Z0-9 -]{3,12}$/.test(postal))
    throw bad('Enter the address as: street, city, state, PIN code (separated by commas).');
  return {
    type: 'CURRENT',
    line1: parts.slice(0, -3).join(', ').slice(0, 200),
    city: parts.at(-3)!,
    state: parts.at(-2)!,
    postalCode: postal,
    country: 'IN',
  };
}

async function saveProfile(id: string, input: EmployeeInput, current: Row | null) {
  const cur = current ? toEmployee({ id } as Row, current) : null;
  if (!cur || cur.dateOfBirth !== input.dateOfBirth || cur.gender !== input.gender)
    await api.put(`/employees/${id}/personal`, {
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
    });
  if (!cur || cur.address !== input.address.trim())
    await api.put(`/employees/${id}/address`, parseAddress(input.address));
  if (
    !cur ||
    cur.emergencyContactName !== input.emergencyContactName.trim() ||
    cur.emergencyContactPhone !== input.emergencyContactPhone.trim()
  )
    await api.post(`/employees/${id}/emergency-contacts`, {
      name: input.emergencyContactName.trim(),
      relationship: 'Emergency contact',
      phone: input.emergencyContactPhone.trim(),
    });
}

async function applyStatus(id: string, target: EmployeeInput['status']) {
  const note = 'Status changed from the HR portal';
  if (target === 'ON_NOTICE')
    await api.patch(`/employees/${id}/status`, {
      status: 'NOTICE_PERIOD',
      resignationDate: todayStr(),
      note,
    });
  else await api.patch(`/employees/${id}/status`, { status: target, note });
}

async function fullEmployee(id: string) {
  const [e, profile] = await Promise.all([api.get(`/employees/${id}`), profileOf(id)]);
  return toEmployee(e, profile);
}

const createEmployee: Handler = async ({ body }) => {
  const input = body as EmployeeInput;
  parseAddress(input.address); // fail before anything is created
  const created = await api.post('/employees', {
    employeeCode: input.employeeCode.trim().toUpperCase(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    departmentId: input.departmentId,
    designationId: input.designationId,
    branchId: input.branchId,
    shiftId: input.shiftId,
    managerId: input.managerId || undefined,
    joiningDate: input.joiningDate,
  });
  invalidateEmployees();
  await saveProfile(created.id, input, null);
  if (input.status !== 'ACTIVE') await applyStatus(created.id, input.status);
  invalidateEmployees();
  return out(await fullEmployee(created.id), 201);
};

const updateEmployee: Handler = async ({ match, body }) => {
  const id = match[0];
  const input = body as EmployeeInput;
  const [cur, profile] = await Promise.all([api.get(`/employees/${id}`), profileOf(id)]);
  if (input.address?.trim()) parseAddress(input.address);
  // Only changed fields are sent: the backend refuses assignment changes on employees with payroll history.
  const patch = compact({
    employeeCode:
      input.employeeCode.trim().toUpperCase() !== cur.employeeCode
        ? input.employeeCode.trim().toUpperCase()
        : undefined,
    firstName: input.firstName.trim() !== cur.firstName ? input.firstName.trim() : undefined,
    lastName: input.lastName.trim() !== cur.lastName ? input.lastName.trim() : undefined,
    email: input.email.trim().toLowerCase() !== cur.email ? input.email.trim() : undefined,
    phone: input.phone.trim() !== (cur.phone ?? '') ? input.phone.trim() : undefined,
    departmentId: input.departmentId !== cur.departmentId ? input.departmentId : undefined,
    designationId: input.designationId !== cur.designationId ? input.designationId : undefined,
    branchId: input.branchId !== cur.branchId ? input.branchId : undefined,
    shiftId: input.shiftId !== cur.shiftId ? input.shiftId : undefined,
    joiningDate: input.joiningDate !== day(cur.joiningDate) ? input.joiningDate : undefined,
    managerId:
      (input.managerId ?? null) !== (cur.managerId ?? null)
        ? (input.managerId ?? (null as unknown as undefined))
        : undefined,
  });
  if (Object.keys(patch).length) await api.patch(`/employees/${id}`, patch);
  await saveProfile(id, input, profile ?? { personal: null, addresses: [], emergencyContacts: [] });
  if ((STATUS_FROM[cur.status] ?? 'INACTIVE') !== input.status) await applyStatus(id, input.status);
  invalidateEmployees();
  return fullEmployee(id);
};

const listEmployees: Handler = async ({ query }) => {
  const page = Number(query.page ?? 1);
  const pageSize = Math.min(Number(query.pageSize ?? 10), 500);
  const status = query.status === 'ON_NOTICE' ? 'NOTICE_PERIOD' : query.status;
  const { items, total } = await fetchPage(
    '/employees',
    {
      search: query.search,
      departmentId: query.departmentId,
      designationId: query.designationId,
      branchId: query.branchId,
      status,
      sortBy: EMP_SORT[query.sort] ?? 'employeeCode',
      sortOrder: query.order === 'desc' ? 'desc' : 'asc',
    },
    page,
    pageSize,
  );
  return {
    data: items.map((e) => toEmployee(e)),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
};

/* ------------------------------- attendance ------------------------------- */

const matches = (e: Row, q: Row) =>
  (!q.departmentId || e.departmentId === q.departmentId) &&
  (!q.branchId || e.branchId === q.branchId) &&
  (!q.search ||
    `${e.employeeCode} ${fullName(e)} ${e.email}`
      .toLowerCase()
      .includes(String(q.search).toLowerCase()));

async function dailyAttendance(query: Row, scope: 'all' | 'team') {
  const me = await loadMe();
  const date = query.date ?? todayStr();
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 10);
  const team = scope === 'team' ? await teamIds(me) : null;
  const emps = (await employees()).filter(
    (e) =>
      isWorking(e) && day(e.joiningDate) <= date && (!team || team.has(e.id)) && matches(e, query),
  );
  const att = new Map(
    (await fetchAll('/attendance', { from: date, to: date })).map((a) => [a.employeeId, a]),
  );
  const records = emps.map((e) => toAttendanceRecord(e, att.get(e.id), date));
  const summary = emptySummary();
  for (const r of records) if (r.status) summary[r.status]++;
  const shown = query.status ? records.filter((r) => r.status === query.status) : records;
  return { ...paginate(shown, page, pageSize), summary };
}

const monthlyAttendance: Handler = async ({ query }) => {
  const month: string = query.month;
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const emps = (await employees()).filter((e) => isWorking(e) && matches(e, query));
  const paged = paginate(emps, Number(query.page ?? 1), Number(query.pageSize ?? 15));
  const rows = await Promise.all(
    paged.data.map(async (e) => {
      const att = await fetchAll('/attendance', {
        employeeId: e.id,
        from: `${month}-01`,
        to: lastDayOfMonth(month),
      });
      const days: (AttendanceStatus | null)[] = Array.from({ length: daysInMonth }, () => null);
      for (const a of att) days[Number(day(a.date).slice(8, 10)) - 1] = a.status;
      return { employeeId: e.id, employeeCode: e.employeeCode, employeeName: fullName(e), days };
    }),
  );
  return { ...paged, data: rows, month, daysInMonth };
};

const myAttendance: Handler = async ({ query }) => {
  const me = await loadMe();
  const month: string = query.month;
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const att = me.employeeId
    ? await fetchAll('/attendance', {
        employeeId: me.employeeId,
        from: `${month}-01`,
        to: lastDayOfMonth(month),
      })
    : [];
  const byDate = new Map(att.map((a) => [day(a.date), a]));
  const summary = emptySummary();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const a = byDate.get(date);
    if (a) summary[a.status as AttendanceStatus]++;
    return {
      date,
      status: (a?.status as AttendanceStatus) ?? null,
      checkIn: hhmm(a?.checkIn),
      checkOut: hhmm(a?.checkOut),
    };
  });
  return { month, days, summary };
};

async function loadRegularizations(filter: (r: Row) => boolean, status?: string, params?: Row) {
  const [rows, idx] = await Promise.all([
    fetchAll('/attendance/regularizations', params),
    empIndex(),
  ]);
  return rows
    .filter((r) => filter(r) && (!status || r.status === status))
    .map((r) => toRegularization(r, idx.get(r.employeeId)));
}

const teamMembers: Handler = async () => {
  const me = await loadMe();
  const date = todayStr();
  const att = new Map(
    (await fetchAll('/attendance', { from: date, to: date })).map((a) => [a.employeeId, a]),
  );
  return (await employees())
    .filter((e) => e.managerId === me.employeeId)
    .map((e) => ({
      ...toEmployee(e),
      todayStatus: (att.get(e.id)?.status as AttendanceStatus) ?? null,
    }));
};

/* ---------------------------------- leave ---------------------------------- */

async function loadLeaveRequests(params: Row, keep: (r: Row) => boolean) {
  const [rows, idx] = await Promise.all([fetchAll('/leave/requests', params), empIndex()]);
  return rows.filter(keep).map((r) => toLeaveRequest(r, idx.get(r.employeeId)));
}

const filterLeave = (q: Row) => (r: LeaveRequest) =>
  (!q.status || r.status === q.status) &&
  (!q.search ||
    `${r.employeeName} ${r.employeeCode}`.toLowerCase().includes(String(q.search).toLowerCase()));

async function leaveList(query: Row, scope: 'all' | 'team') {
  const me = await loadMe();
  const [rows, emps] = await Promise.all([loadLeaveRequests({}, () => true), employees()]);
  const team = scope === 'team' ? await teamIds(me) : null;
  const deptOf = new Map(emps.map((e) => [e.id, e.departmentId]));
  const shown = rows.filter(
    (r) =>
      (!team || team.has(r.employeeId)) &&
      (!query.departmentId || deptOf.get(r.employeeId) === query.departmentId) &&
      filterLeave(query)(r),
  );
  return paginate(shown, Number(query.page ?? 1), Number(query.pageSize ?? 10));
}

async function leaveCalendar(month: string, scope: 'all' | 'team') {
  const me = await loadMe();
  const team = scope === 'team' ? await teamIds(me) : null;
  const rows = await loadLeaveRequests({ from: `${month}-01`, to: lastDayOfMonth(month) }, (r) =>
    ['APPROVED', 'PENDING'].includes(r.status),
  );
  return rows
    .filter((r) => !team || team.has(r.employeeId))
    .map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      leaveTypeName: r.leaveTypeName,
      fromDate: r.fromDate,
      toDate: r.toDate,
      status: r.status,
    }));
}

const myBalances: Handler = async () => {
  const me = await loadMe();
  if (!me.employeeId) return [];
  const rows = await fetchAll('/leave/balances', { employeeId: me.employeeId });
  return rows
    .filter((b) => b.year === currentYear())
    .map((b) => ({
      leaveTypeId: b.leaveTypeId,
      leaveTypeName: b.leaveType?.name ?? '',
      entitled: num(b.entitled),
      used: num(b.used),
      pending: num(b.reserved),
      available: num(b.available),
    }));
};

/** Estimate shown while filling the form; the backend recalculates (and enforces) the real figure on submit. */
const leavePreview: Handler = async ({ query }) => {
  const me = await loadMe();
  const { leaveTypeId, fromDate, toDate } = query;
  if (!fromDate || !toDate || toDate < fromDate)
    return {
      days: 0,
      available: null,
      sufficient: false,
      message: 'End date must be on or after the start date.',
    };
  const emp = me.employeeId ? ((await empIndex()).get(me.employeeId) ?? null) : null;
  const [shifts, holidays, types, balances] = await Promise.all([
    fetchAll('/shifts'),
    fetchAll('/holidays', { from: fromDate, to: toDate }),
    api.get('/leave/types'),
    myBalances({ method: 'get', query: {}, body: null, match: [] }) as Promise<Row[]>,
  ]);
  const off: number[] = shifts.find((s) => s.id === emp?.shiftId)?.weeklyOff ?? [6, 7];
  const holidayDates = new Set(
    holidays.filter((h) => !h.branchId || h.branchId === emp?.branchId).map((h) => day(h.date)),
  );
  let days = 0;
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    const iso = ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // Mon=1 … Sun=7
    if (!off.includes(iso) && !holidayDates.has(d)) days++;
  }
  const type = types.items.find((t: Row) => t.id === leaveTypeId);
  const bal = balances.find((b) => b.leaveTypeId === leaveTypeId);
  if (!type?.paid || !bal) return { days, available: null, sufficient: true, message: null };
  const sufficient = days <= bal.available;
  return {
    days,
    available: bal.available,
    sufficient,
    message: sufficient ? null : `Only ${bal.available} day(s) available for this leave type.`,
  };
};

/* --------------------------------- payroll --------------------------------- */

async function payrollTotals(): Promise<Map<string, Row>> {
  try {
    const res = await api.get('/reports/payroll');
    return new Map(res.items.map((i: Row) => [i.runId, i]));
  } catch {
    return new Map();
  }
}
const toPeriod = (run: Row, totals: Map<string, Row>): PayrollPeriod => {
  const t = totals.get(run.id);
  return {
    id: run.id,
    month: ym(run.period),
    status: RUN_STATUS[run.status] ?? 'DRAFT',
    employeeCount: t?.employees ?? run.employees?.length ?? 0,
    totalGross: num(t?.gross),
    totalDeductions: num(t?.deductions),
    totalNet: num(t?.net),
  };
};
async function period(id: string) {
  const [run, totals] = await Promise.all([api.get(`/payroll/runs/${id}`), payrollTotals()]);
  return { run, period: toPeriod(run, totals) };
}

const payrollDetail: Handler = async ({ match }) => {
  const { run, period: p } = await period(match[0]);
  const by = new Map<string, { employees: number; cents: number }>();
  for (const pe of run.employees as Row[]) {
    const dept = pe.snapshot?.department ?? '—';
    const cur = by.get(dept) ?? { employees: 0, cents: 0 };
    by.set(dept, { employees: cur.employees + 1, cents: cur.cents + cents(pe.net) });
  }
  return {
    ...p,
    departmentSummary: [...by].map(([department, v]) => ({
      department,
      employees: v.employees,
      totalNet: v.cents / 100,
    })),
  };
};

const payrollEntries: Handler = async ({ match, query }) => {
  const [run, idx] = await Promise.all([api.get(`/payroll/runs/${match[0]}`), empIndex()]);
  const search = String(query.search ?? '').toLowerCase();
  const rows: PayrollEntry[] = (run.employees as Row[])
    .filter(
      (pe) =>
        (!query.departmentId || idx.get(pe.employeeId)?.departmentId === query.departmentId) &&
        (!search ||
          `${pe.snapshot?.name} ${pe.snapshot?.employeeCode}`.toLowerCase().includes(search)),
    )
    .map((pe) => ({
      id: pe.id,
      employeeId: pe.employeeId,
      employeeCode: pe.snapshot?.employeeCode ?? '',
      employeeName: pe.snapshot?.name ?? '',
      departmentName: pe.snapshot?.department ?? '',
      designationName: pe.snapshot?.designation ?? '',
      ...toBreakdown(pe),
    }))
    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
  return paginate(rows, Number(query.page ?? 1), Number(query.pageSize ?? 10));
};

const PAYROLL_ACTION: Record<string, string> = {
  submit: 'process',
  approve: 'approve',
  lock: 'lock',
};

const myPayslips: Handler = async () => {
  const me = await loadMe();
  const rows = await fetchAll('/payslips');
  return rows
    .filter((s) => s.payrollEmployee?.employeeId === me.employeeId)
    .map((s) => ({
      id: s.id,
      month: ym(s.payrollEmployee.run.period),
      gross: num(s.payrollEmployee.gross),
      net: num(s.payrollEmployee.net),
      publishedOn: day(s.publishedAt),
    }));
};
const payslipDetail: Handler = async ({ match }) => {
  const s = await api.get(`/payslips/${match[0]}`);
  const pe = s.payrollEmployee;
  return {
    id: s.id,
    month: ym(pe.run.period),
    employeeName: pe.snapshot?.name ?? '',
    employeeCode: pe.snapshot?.employeeCode ?? '',
    departmentName: pe.snapshot?.department ?? '',
    designationName: pe.snapshot?.designation ?? '',
    publishedOn: day(s.publishedAt),
    ...toBreakdown(pe),
  };
};

/* -------------------------- documents & checklists -------------------------- */

const myDocuments: Handler = async () => {
  const me = await loadMe();
  if (!me.employeeId) return [];
  const [rows, idx] = await Promise.all([
    fetchAll('/documents', { employeeId: me.employeeId }),
    empIndex(),
  ]);
  return rows.map((d) => toDocument(d, idx.get(d.employeeId)));
};

const uploadDocument: Handler = async ({ body }) => {
  const me = await loadMe();
  const form = new FormData();
  form.append('employeeId', requireEmployee(me));
  form.append('category', DOC_TO[String(body.get('documentType'))] ?? 'OTHER');
  form.append('file', body.get('file'));
  const d = await call<Row>({ method: 'post', url: '/documents', data: form }).then((r) => r.data);
  return out(toDocument(d, (await empIndex()).get(d.employeeId)), 201);
};

const allDocuments: Handler = async ({ query }) => {
  const [rows, idx] = await Promise.all([fetchAll('/documents'), empIndex()]);
  const search = String(query.search ?? '').toLowerCase();
  const shown = rows
    .map((d) => toDocument(d, idx.get(d.employeeId)))
    .filter(
      (d) =>
        (!query.status || d.status === query.status) &&
        (!query.documentType || d.documentType === query.documentType) &&
        (!search ||
          `${d.employeeName} ${d.employeeCode} ${d.fileName}`.toLowerCase().includes(search)),
    );
  return paginate(shown, Number(query.page ?? 1), Number(query.pageSize ?? 10));
};

async function processes(kind: string) {
  const [rows, idx] = await Promise.all([fetchAll(`/${kind}`), empIndex()]);
  return rows.map((c) => toProcess(c, idx.get(c.employeeId)));
}
const completeTask: Handler = async ({ match }) => {
  const [kind, id, taskId] = match;
  await api.patch(`/${kind}/${id}/tasks/${taskId}`, { completed: true });
  const all = await processes(kind);
  const p = all.find((x) => x.id === id)!;
  // Finishing the last onboarding task closes the checklist; offboarding is closed deliberately by HR
  // (it deactivates the account), so it is never closed implicitly.
  if (kind === 'onboarding' && p.status === 'IN_PROGRESS' && p.items.every((i) => i.done)) {
    try {
      await api.post(`/onboarding/${id}/complete`);
      return (await processes(kind)).find((x) => x.id === id)!;
    } catch {
      /* needs bank details, a document and an active account: leave it open */
    }
  }
  return p;
};

/* ------------------------------- notifications ------------------------------- */

function notificationType(event: string, title: string): NotificationType {
  const t = title.toLowerCase();
  if (event.startsWith('leave'))
    return t.includes('reject')
      ? 'LEAVE_REJECTED'
      : t.includes('approv')
        ? 'LEAVE_APPROVED'
        : 'GENERAL';
  if (event.startsWith('attendance.regularization'))
    return t.includes('reject')
      ? 'REGULARIZATION_REJECTED'
      : t.includes('approv')
        ? 'REGULARIZATION_APPROVED'
        : 'GENERAL';
  if (event.includes('payslip') || event.startsWith('payroll')) return 'PAYSLIP_AVAILABLE';
  return 'GENERAL';
}
const notificationHref = (event: string): string | null =>
  event.startsWith('leave')
    ? '/me/leave'
    : event.startsWith('attendance')
      ? '/me/attendance'
      : null;

const listNotifications: Handler = async ({ query }) => {
  const res = await api.get('/notifications', { limit: Math.min(Number(query.limit ?? 20), 100) });
  const items: AppNotification[] = res.items.map((n: Row) => ({
    id: n.id,
    type: notificationType(n.event, n.title),
    title: n.title,
    message: n.title,
    createdAt: n.createdAt,
    read: !!n.readAt,
    href: notificationHref(n.event),
  }));
  return { items, unreadCount: items.filter((i) => !i.read).length };
};
const readAll: Handler = async () => {
  const res = await api.get('/notifications', { limit: 100 });
  await Promise.all(
    res.items
      .filter((n: Row) => !n.readAt)
      .map((n: Row) => api.patch(`/notifications/${n.id}/read`)),
  );
  return out(null, 204);
};

/* --------------------------------- reports --------------------------------- */

async function reportRange(kind: string, q: Row) {
  if (kind !== 'payroll') return { from: q.from, to: q.to };
  const runs = await fetchAll('/payroll/runs');
  const run = q.periodId
    ? runs.find((r) => r.id === q.periodId)
    : [...runs].sort((a, b) => ym(b.period).localeCompare(ym(a.period)))[0];
  if (!run) return { from: undefined, to: undefined };
  const month = ym(run.period);
  return { from: `${month}-01`, to: lastDayOfMonth(month) };
}

const STATUS_LABEL = (s: string) =>
  s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

const getReport: Handler = async ({ match, query }) => {
  const kind = match[0];
  const range = await reportRange(kind, query);
  const res = await api.get(`/reports/${kind}`, range);
  let report: ReportResponse;
  if (kind === 'headcount') {
    if (query.departmentId || query.branchId) {
      // The backend report has no filters, so a filtered headcount is counted from the employee list.
      const counts = new Map<string, number>();
      const subset = (await employees()).filter(
        (e) =>
          (!query.departmentId || e.departmentId === query.departmentId) &&
          (!query.branchId || e.branchId === query.branchId),
      );
      for (const e of subset)
        counts.set(e.department?.name ?? '—', (counts.get(e.department?.name ?? '—') ?? 0) + 1);
      res.department = [...counts].map(([name, count]) => ({ name, count }));
      res.total = subset.length;
    }
    report = {
      columns: [
        { key: 'department', label: 'Department' },
        { key: 'count', label: 'Employees', numeric: true },
      ],
      rows: res.department.map((d: Row) => ({ department: d.name, count: d.count })),
      totals: { department: 'Total', count: res.total },
    };
  } else if (kind === 'attendance') {
    report = {
      columns: [
        { key: 'status', label: 'Status' },
        { key: 'days', label: 'Days', numeric: true },
        { key: 'late', label: 'Late (min)', numeric: true },
        { key: 'overtime', label: 'Overtime (min)', numeric: true },
      ],
      rows: res.items.map((i: Row) => ({
        status: STATUS_LABEL(i.status),
        days: i.count,
        late: num(i.lateMinutes),
        overtime: num(i.overtimeMinutes),
      })),
      totals: {
        status: 'Total',
        days: res.items.reduce((a: number, i: Row) => a + i.count, 0),
        late: res.items.reduce((a: number, i: Row) => a + num(i.lateMinutes), 0),
        overtime: res.items.reduce((a: number, i: Row) => a + num(i.overtimeMinutes), 0),
      },
    };
  } else if (kind === 'leave') {
    if (query.leaveTypeId) {
      const name = (await api.get('/leave/types')).items.find(
        (t: Row) => t.id === query.leaveTypeId,
      )?.name;
      res.items = res.items.filter((i: Row) => i.leaveType === name);
    }
    report = {
      columns: [
        { key: 'leaveType', label: 'Leave type' },
        { key: 'status', label: 'Status' },
        { key: 'requests', label: 'Requests', numeric: true },
        { key: 'days', label: 'Days', numeric: true },
      ],
      rows: res.items.map((i: Row) => ({
        leaveType: i.leaveType,
        status: STATUS_LABEL(i.status),
        requests: i.count,
        days: num(i.days),
      })),
      totals: {
        leaveType: 'Total',
        status: '',
        requests: res.items.reduce((a: number, i: Row) => a + i.count, 0),
        days: res.items.reduce((a: number, i: Row) => a + num(i.days), 0),
      },
    };
  } else {
    report = {
      columns: [
        { key: 'month', label: 'Month' },
        { key: 'status', label: 'Status' },
        { key: 'employees', label: 'Employees', numeric: true },
        { key: 'gross', label: 'Gross', numeric: true, money: true },
        { key: 'deductions', label: 'Deductions', numeric: true, money: true },
        { key: 'net', label: 'Net pay', numeric: true, money: true },
        { key: 'employerCost', label: 'Employer cost', numeric: true, money: true },
      ],
      rows: res.items.map((i: Row) => ({
        month: ym(i),
        status: STATUS_LABEL(i.status),
        employees: i.employees,
        gross: num(i.gross),
        deductions: num(i.deductions),
        net: num(i.net),
        employerCost: num(i.employerCost),
      })),
      totals: {
        month: 'Total',
        status: '',
        employees: res.items.reduce((a: number, i: Row) => a + i.employees, 0),
        gross: sumMoney(res.items.map((i: Row) => i.gross)),
        deductions: sumMoney(res.items.map((i: Row) => i.deductions)),
        net: sumMoney(res.items.map((i: Row) => i.net)),
        employerCost: sumMoney(res.items.map((i: Row) => i.employerCost)),
      },
    };
  }
  return report;
};

const exportReport: Handler = async ({ match, query }) => {
  if (query.format && query.format !== 'csv')
    throw bad('Only CSV export is available from the backend. Use “Export CSV”.');
  const range = await reportRange(match[0], query);
  const res = await call<Blob>({
    method: 'get',
    url: `/reports/${match[0]}/export`,
    params: range,
    responseType: 'blob',
  });
  return out(res.data, 200, res.headers as Record<string, string>);
};

/* -------------------------------- dashboard -------------------------------- */

const hrDashboard: Handler = async () => {
  const today = todayStr();
  const lastWeek = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const [hc, todayAtt, trend, leave, regs, holidays, emps] = await Promise.all([
    api.get('/reports/headcount'),
    api.get('/reports/attendance', { from: today, to: today }),
    Promise.all(lastWeek.map((d) => api.get('/reports/attendance', { from: d, to: d }))),
    fetchAll('/leave/requests', undefined, 5),
    fetchAll('/attendance/regularizations', undefined, 5),
    fetchAll('/holidays', { from: today, to: addDays(today, 120) }),
    employees(),
  ]);
  const count = (items: Row[], status: string) =>
    items.find((i) => i.status === status)?.count ?? 0;
  const since = addDays(today, -30);
  return {
    totalEmployees: hc.total,
    activeEmployees: count(hc.status, 'ACTIVE'),
    presentToday: count(todayAtt.items, 'PRESENT') + count(todayAtt.items, 'HALF_DAY'),
    absentToday: count(todayAtt.items, 'ABSENT'),
    onLeaveToday: count(todayAtt.items, 'LEAVE'),
    newJoiners: emps.filter((e) => day(e.joiningDate) >= since).length,
    pendingApprovals: {
      leave: leave.filter((r) => r.status === 'PENDING').length,
      regularization: regs.filter((r) => r.status === 'PENDING').length,
    },
    departmentDistribution: hc.department.map((d: Row) => ({ department: d.name, count: d.count })),
    attendanceSummary: lastWeek.map((date, i) => ({
      date,
      present: count(trend[i].items, 'PRESENT') + count(trend[i].items, 'HALF_DAY'),
      absent: count(trend[i].items, 'ABSENT'),
      onLeave: count(trend[i].items, 'LEAVE'),
    })),
    upcomingHolidays: holidays.slice(0, 5).map(holidayShape),
  };
};

/* ---------------------------------- routes ---------------------------------- */

const unsupported =
  (message: string): Handler =>
  async () => {
    throw new BackendNotSupported(message);
  };
const downloadOf =
  (path: (id: string) => string): Handler =>
  async ({ match }) => {
    const res = await call<Blob>({ method: 'get', url: path(match[0]), responseType: 'blob' });
    return out(res.data, 200, res.headers as Record<string, string>);
  };

export const ROUTES: [string, RegExp, Handler][] = [
  ['post', /^\/auth\/login$/, login],
  ['get', /^\/auth\/me$/, whoami],
  ['post', /^\/auth\/logout$/, logout],

  ...masterHandlers(
    '/departments',
    (r) => ({ id: r.id, name: r.name, code: r.code }),
    (b) => compact({ name: b.name, code: b.code ? codeOf(b) : undefined }),
  ),
  ...masterHandlers(
    '/designations',
    (r) => ({ id: r.id, name: r.name, code: r.code }),
    (b) =>
      compact({ name: b.name, code: b.code ? codeOf(b) : b.name ? deriveCode(b.name) : undefined }),
  ),
  ...masterHandlers(
    '/branches',
    (r) => ({ id: r.id, name: r.name, code: r.code, city: '' }),
    (b) =>
      compact({ name: b.name, code: b.code ? codeOf(b) : b.name ? deriveCode(b.name) : undefined }),
  ),
  [
    'get',
    /^\/shifts$/,
    async () => (await fetchAll('/shifts')).filter((s) => s.active).map(shiftShape),
  ],
  [
    'post',
    /^\/shifts$/,
    async ({ body }) => out(shiftShape(await api.post('/shifts', shiftBody(body))), 201),
  ],
  [
    'patch',
    /^\/shifts\/([^/]+)$/,
    async ({ match, body }) => shiftShape(await api.patch(`/shifts/${match[0]}`, shiftBody(body))),
  ],
  [
    'delete',
    /^\/shifts\/([^/]+)$/,
    async ({ match }) => {
      await api.patch(`/shifts/${match[0]}`, { active: false });
      return out(null, 204);
    },
  ],
  ['get', /^\/holidays$/, async () => (await fetchAll('/holidays')).map(holidayShape)],
  [
    'post',
    /^\/holidays$/,
    async ({ body }) =>
      out(holidayShape(await api.post('/holidays', { name: body.name, date: body.date })), 201),
  ],
  [
    'patch',
    /^\/holidays\/([^/]+)$/,
    async ({ match, body }) => {
      // The backend has no holiday update: replace it (remove, then add with the new details).
      const old = (await fetchAll('/holidays')).find((h) => h.id === match[0]);
      if (!old) throw bad('Holiday not found.');
      await api.del(`/holidays/${match[0]}`);
      return holidayShape(
        await api.post('/holidays', {
          name: body.name ?? old.name,
          date: body.date ?? day(old.date),
          branchId: old.branchId ?? undefined,
        }),
      );
    },
  ],
  [
    'delete',
    /^\/holidays\/([^/]+)$/,
    async ({ match }) => {
      await api.del(`/holidays/${match[0]}`);
      return out(null, 204);
    },
  ],
  [
    'get',
    /^\/leave-types$/,
    async () =>
      (await api.get('/leave/types')).items.filter((t: Row) => t.active).map(leaveTypeShape),
  ],
  [
    'post',
    /^\/leave-types$/,
    async ({ body }) => {
      const t = await api.post('/leave/types', {
        name: body.name,
        code: String(body.code).toUpperCase(),
        paid: body.paid === 'PAID',
      });
      await setEntitlement(t.id, body.annualDays);
      return out(await leaveTypeById(t.id), 201);
    },
  ],
  [
    'patch',
    /^\/leave-types\/([^/]+)$/,
    async ({ match, body }) => {
      const before = await leaveTypeById(match[0]);
      await api.patch(`/leave/types/${match[0]}`, leaveTypeBody(body));
      if (body.annualDays !== undefined && String(body.annualDays) !== before.annualDays)
        await setEntitlement(match[0], body.annualDays);
      return leaveTypeById(match[0]);
    },
  ],
  [
    'delete',
    /^\/leave-types\/([^/]+)$/,
    async ({ match }) => {
      await api.patch(`/leave/types/${match[0]}`, { active: false });
      return out(null, 204);
    },
  ],

  ['get', /^\/employees$/, listEmployees],
  ['post', /^\/employees$/, createEmployee],
  ['get', /^\/employees\/([^/]+)$/, async ({ match }) => fullEmployee(match[0])],
  ['patch', /^\/employees\/([^/]+)$/, updateEmployee],
  [
    'get',
    /^\/employees\/([^/]+)\/documents$/,
    async ({ match }) => {
      const [rows, idx] = await Promise.all([
        fetchAll('/documents', { employeeId: match[0] }),
        empIndex(),
      ]);
      return rows.map((d) => toDocument(d, idx.get(d.employeeId)));
    },
  ],
  ['get', /^\/dashboard\/hr$/, hrDashboard],

  ['get', /^\/attendance\/daily$/, async ({ query }) => dailyAttendance(query, 'all')],
  ['get', /^\/team\/attendance$/, async ({ query }) => dailyAttendance(query, 'team')],
  ['get', /^\/attendance\/monthly$/, monthlyAttendance],
  ['get', /^\/me\/attendance$/, myAttendance],
  ['get', /^\/team\/members$/, teamMembers],
  [
    'get',
    /^\/me\/regularizations$/,
    async () => {
      const me = await loadMe();
      return me.employeeId
        ? loadRegularizations(() => true, undefined, { employeeId: me.employeeId })
        : [];
    },
  ],
  [
    'post',
    /^\/me\/regularizations$/,
    async ({ body }) => {
      const outDate =
        body.requestedCheckOut <= body.requestedCheckIn ? addDays(body.date, 1) : body.date;
      const row = await api.post('/attendance/regularizations', {
        date: body.date,
        checkIn: toInstant(body.date, body.requestedCheckIn),
        checkOut: toInstant(outDate, body.requestedCheckOut),
        reason: body.reason,
      });
      return out(toRegularization(row, (await empIndex()).get(row.employeeId)), 201);
    },
  ],
  [
    'get',
    /^\/regularizations$/,
    async ({ query }) => loadRegularizations(() => true, query.status),
  ],
  [
    'get',
    /^\/team\/regularizations$/,
    async ({ query }) => {
      const team = await teamIds(await loadMe());
      return loadRegularizations((r) => team.has(r.employeeId), query.status);
    },
  ],
  [
    'post',
    /^\/regularizations\/([^/]+)\/(approve|reject)$/,
    async ({ match, body }) => {
      const row = await api.post(`/attendance/regularizations/${match[0]}/review`, {
        decision: match[1] === 'approve' ? 'APPROVED' : 'REJECTED',
        note: body?.comment || undefined,
      });
      return toRegularization(row, (await empIndex()).get(row.employeeId));
    },
  ],

  ['get', /^\/me\/leave\/balances$/, myBalances],
  [
    'get',
    /^\/me\/leave$/,
    async () => {
      const me = await loadMe();
      return me.employeeId ? loadLeaveRequests({ employeeId: me.employeeId }, () => true) : [];
    },
  ],
  ['get', /^\/leave\/preview$/, leavePreview],
  [
    'post',
    /^\/me\/leave$/,
    async ({ body }) => {
      const row = await api.post('/leave/requests', {
        leaveTypeId: body.leaveTypeId,
        startDate: body.fromDate,
        endDate: body.toDate,
        reason: body.reason,
      });
      const full = (await fetchAll('/leave/requests', { employeeId: row.employeeId })).find(
        (r) => r.id === row.id,
      );
      return out(toLeaveRequest(full ?? row, (await empIndex()).get(row.employeeId)), 201);
    },
  ],
  [
    'post',
    /^\/me\/leave\/([^/]+)\/cancel$/,
    async ({ match }) => {
      await api.post(`/leave/requests/${match[0]}/cancel`);
      return out(null, 204);
    },
  ],
  ['get', /^\/leave\/requests$/, async ({ query }) => leaveList(query, 'all')],
  ['get', /^\/team\/leave\/requests$/, async ({ query }) => leaveList(query, 'team')],
  [
    'post',
    /^\/leave\/requests\/([^/]+)\/(approve|reject)$/,
    async ({ match, body }) => {
      const row = await api.post(`/leave/requests/${match[0]}/review`, {
        decision: match[1] === 'approve' ? 'APPROVED' : 'REJECTED',
        note: body?.comment || undefined,
      });
      return toLeaveRequest(row, (await empIndex()).get(row.employeeId));
    },
  ],
  ['get', /^\/leave\/calendar$/, async ({ query }) => leaveCalendar(query.month, 'all')],
  ['get', /^\/team\/leave\/calendar$/, async ({ query }) => leaveCalendar(query.month, 'team')],

  [
    'get',
    /^\/payroll\/periods$/,
    async () => {
      const [runs, totals] = await Promise.all([fetchAll('/payroll/runs'), payrollTotals()]);
      return runs.map((r) => toPeriod(r, totals)).sort((a, b) => b.month.localeCompare(a.month));
    },
  ],
  [
    'post',
    /^\/payroll\/periods$/,
    async ({ body }) => {
      const [year, month] = String(body.month).split('-').map(Number);
      const run = await api.post('/payroll/runs', { year, month });
      return out((await period(run.id)).period, 201);
    },
  ],
  ['get', /^\/payroll\/periods\/([^/]+)$/, payrollDetail],
  ['get', /^\/payroll\/periods\/([^/]+)\/entries$/, payrollEntries],
  [
    'post',
    /^\/payroll\/periods\/([^/]+)\/(submit|approve|lock)$/,
    async ({ match }) => {
      await api.post(`/payroll/runs/${match[0]}/${PAYROLL_ACTION[match[1]]}`);
      return (await period(match[0])).period;
    },
  ],
  ['get', /^\/me\/payslips$/, myPayslips],
  ['get', /^\/me\/payslips\/([^/]+)$/, payslipDetail],
  ['get', /^\/me\/payslips\/([^/]+)\/download$/, downloadOf((id) => `/payslips/${id}/print`)],

  ['get', /^\/me\/documents$/, myDocuments],
  ['post', /^\/me\/documents$/, uploadDocument],
  [
    'delete',
    /^\/me\/documents\/([^/]+)$/,
    async ({ match }) => {
      await api.del(`/documents/${match[0]}`);
      return out(null, 204);
    },
  ],
  ['get', /^\/documents$/, allDocuments],
  ['get', /^\/documents\/([^/]+)\/file$/, downloadOf((id) => `/documents/${id}/download`)],
  [
    'post',
    /^\/documents\/([^/]+)\/(verify|reject)$/,
    unsupported('Document verification is not available in this backend yet.'),
  ],

  ['get', /^\/(onboarding|offboarding)$/, async ({ match }) => processes(match[0])],
  ['post', /^\/(onboarding|offboarding)\/([^/]+)\/items\/([^/]+)\/complete$/, completeTask],

  ['get', /^\/notifications$/, listNotifications],
  ['post', /^\/notifications\/read-all$/, readAll],
  [
    'post',
    /^\/notifications\/([^/]+)\/read$/,
    async ({ match }) => {
      await api.patch(`/notifications/${match[0]}/read`);
      return out(null, 204);
    },
  ],

  ['get', /^\/reports\/(headcount|attendance|leave|payroll)$/, getReport],
  ['get', /^\/reports\/(headcount|attendance|leave|payroll)\/export$/, exportReport],
];

// keep helper exports referenced by tests
export const __test = { toBreakdown, toEmployee, deriveCode, parseAddress, notificationType };
