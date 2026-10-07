// Development-only fake payroll, documents, onboarding, notifications and reports backend.
// All payroll figures are produced here, standing in for the NestJS API; the UI only displays them.
import { addDays, format, getDaysInMonth, parseISO, subDays, subMonths } from 'date-fns';
import type {
  ChecklistProcess,
  DocumentStatus,
  DocumentType,
  EmployeeDocument,
  PayrollEntry,
  PayrollPeriod,
  PayrollPeriodDetail,
  PayrollStatus,
  Payslip,
  ReportKind,
  ReportResponse,
  Role,
} from '../api/types';
import type { OrgRow } from '../api/crud';
import { attendanceFor, leaveStore, type MockCtx } from './attendance-leave';
import { db, nextId } from './db';
import { notifStore, notify } from './notifications-store';
import { fail, ok, paginate, type MockResult } from './result';

type Emp = (typeof db.employees)[number];
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const nameOf = (list: OrgRow[], id: string) => list.find((x) => x.id === id)?.name ?? '';
const fullName = (e: Emp) => `${e.firstName} ${e.lastName}`;
const monthLabel = (m: string) => format(parseISO(`${m}-01`), 'MMMM yyyy');
const lastDay = (m: string) =>
  `${m}-${String(getDaysInMonth(parseISO(`${m}-01`))).padStart(2, '0')}`;

// ---------- payroll ----------
interface PeriodRow {
  id: string;
  month: string;
  status: PayrollStatus;
}
const periods: PeriodRow[] = [];
const snapshots = new Map<string, PayrollEntry[]>();
const eligible = (m: string) =>
  db.employees.filter((e) => e.status !== 'INACTIVE' && e.joiningDate <= lastDay(m));

function entryFor(e: Emp, month: string): PayrollEntry {
  const n = Number(e.id);
  const basic =
    Math.round((22000 + ((n * 1373) % 38000) + Number(e.designationId) * 2500) / 100) * 100;
  const allowances = Math.round(basic * 0.4);
  const bonus = month.endsWith('-09') && n % 5 === 0 ? 5000 : 0;
  const overtime = e.departmentId === '5' ? 1200 + (n % 4) * 400 : 0;
  const gross = basic + allowances + bonus + overtime;
  let lopDays = 0;
  for (let d = 1; d <= getDaysInMonth(parseISO(`${month}-01`)); d++)
    if (attendanceFor(e, `${month}-${String(d).padStart(2, '0')}`).status === 'ABSENT') lopDays++;
  const lopDeduction = Math.round((basic / 26) * lopDays);
  const pf = Math.min(1800, Math.round(basic * 0.12));
  const tds = gross > 60000 ? Math.round((gross - 60000) * 0.1) : 0;
  const statutory = [
    { label: 'Provident fund', amount: pf },
    { label: 'Professional tax', amount: 200 },
  ];
  const otherDeductions = tds > 0 ? [{ label: 'Income tax (TDS)', amount: tds }] : [];
  const totalDeductions = lopDeduction + pf + 200 + tds;
  return {
    id: `${month}-${e.id}`,
    employeeId: e.id,
    employeeCode: e.employeeCode,
    employeeName: fullName(e),
    departmentName: nameOf(db.departments, e.departmentId),
    designationName: nameOf(db.designations, e.designationId),
    basic,
    allowances,
    bonus,
    overtime,
    gross,
    lopDays,
    lopDeduction,
    statutory,
    otherDeductions,
    totalDeductions,
    net: gross - totalDeductions,
  };
}
function entriesFor(p: PeriodRow): PayrollEntry[] {
  const cached = snapshots.get(p.id);
  if (cached) return cached;
  const list = eligible(p.month).map((e) => entryFor(e, p.month));
  if (p.status === 'APPROVED' || p.status === 'LOCKED') snapshots.set(p.id, list);
  return list;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function periodOut(p: PeriodRow): PayrollPeriod {
  const es = entriesFor(p);
  return {
    id: p.id,
    month: p.month,
    status: p.status,
    employeeCount: es.length,
    totalGross: sum(es.map((e) => e.gross)),
    totalDeductions: sum(es.map((e) => e.totalDeductions)),
    totalNet: sum(es.map((e) => e.net)),
  };
}
function periodDetail(p: PeriodRow): PayrollPeriodDetail {
  const byDept = new Map<string, { employees: number; totalNet: number }>();
  entriesFor(p).forEach((e) => {
    const x = byDept.get(e.departmentName) ?? { employees: 0, totalNet: 0 };
    byDept.set(e.departmentName, { employees: x.employees + 1, totalNet: x.totalNet + e.net });
  });
  return {
    ...periodOut(p),
    departmentSummary: [...byDept]
      .map(([department, v]) => ({ department, ...v }))
      .sort((a, b) => a.department.localeCompare(b.department)),
  };
}
const thisMonth = format(new Date(), 'yyyy-MM');
(
  [
    [3, 'LOCKED'],
    [2, 'LOCKED'],
    [1, 'APPROVED'],
    [0, 'IN_REVIEW'],
  ] as const
).forEach(([back, status]) => {
  const month = format(subMonths(new Date(), back), 'yyyy-MM');
  periods.push({ id: `p-${month}`, month, status });
});
periods.forEach((p) => entriesFor(p));

// ---------- documents ----------
interface DocRow {
  id: string;
  employeeId: string;
  documentType: DocumentType;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  status: DocumentStatus;
  reviewerComment: string | null;
}
const docs: DocRow[] = [];
const hydrateDoc = (d: DocRow): EmployeeDocument => {
  const e = db.employees.find((x) => x.id === d.employeeId)!;
  return { ...d, employeeCode: e.employeeCode, employeeName: fullName(e) };
};
const seedDoc = (
  employeeId: string,
  documentType: DocumentType,
  fileName: string,
  sizeBytes: number,
  status: DocumentStatus,
  daysAgo: number,
  comment: string | null = null,
) =>
  docs.push({
    id: nextId(),
    employeeId,
    documentType,
    fileName,
    sizeBytes,
    mimeType: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    uploadedAt: subDays(new Date(), daysAgo).toISOString(),
    status,
    reviewerComment: comment,
  });
seedDoc('7', 'ID_PROOF', 'aadhaar-card.pdf', 240_000, 'VERIFIED', 90);
seedDoc('7', 'ADDRESS_PROOF', 'rent-agreement.pdf', 810_000, 'PENDING', 4);
seedDoc(
  '7',
  'EDUCATION',
  'degree-certificate.jpg',
  1_400_000,
  'REJECTED',
  30,
  'The scan is cut off at the bottom. Please upload the full page.',
);
seedDoc('13', 'ID_PROOF', 'pan-card.jpg', 380_000, 'PENDING', 2);
seedDoc('19', 'EXPERIENCE', 'relieving-letter.pdf', 190_000, 'PENDING', 3);
seedDoc('61', 'OFFER_LETTER', 'signed-offer.pdf', 260_000, 'VERIFIED', 20);
seedDoc('62', 'ID_PROOF', 'passport.pdf', 950_000, 'PENDING', 6);

// ---------- onboarding / offboarding ----------
const processes: ChecklistProcess[] = [];
const ON_ITEMS: [string, string][] = [
  ['Issue laptop and ID card', 'IT'],
  ['Create email account', 'IT'],
  ['Collect signed offer letter', 'HR'],
  ['Upload identity documents', 'Employee'],
  ['Complete induction session', 'HR'],
  ['Verify bank details', 'Accounts'],
];
const OFF_ITEMS: [string, string][] = [
  ['Accept resignation', 'HR'],
  ['Agree knowledge-transfer plan', 'Manager'],
  ['Return laptop and access card', 'IT'],
  ['Clear pending dues', 'Accounts'],
  ['Hold exit interview', 'HR'],
  ['Revoke system access', 'IT'],
  ['Prepare final settlement', 'Accounts'],
];
function seedProcess(
  kind: 'ONBOARDING' | 'OFFBOARDING',
  employeeId: string,
  done: number,
  lwdInDays = 0,
) {
  const e = db.employees.find((x) => x.id === employeeId)!;
  const tpl = kind === 'ONBOARDING' ? ON_ITEMS : OFF_ITEMS;
  const id = nextId();
  const lwd = kind === 'OFFBOARDING' ? iso(addDays(new Date(), lwdInDays)) : null;
  processes.push({
    id,
    kind,
    employeeId,
    employeeCode: e.employeeCode,
    employeeName: fullName(e),
    departmentName: nameOf(db.departments, e.departmentId),
    designationName: nameOf(db.designations, e.designationId),
    startDate: e.joiningDate,
    lastWorkingDay: lwd,
    resignationDate: lwd ? iso(subDays(parseISO(lwd), 30)) : null,
    status: done === tpl.length ? 'COMPLETED' : 'IN_PROGRESS',
    items: tpl.map(([title, owner], i) => ({
      id: `${id}-${i + 1}`,
      title,
      owner,
      dueDate: iso(addDays(parseISO(e.joiningDate), i * 2 + 1)),
      done: i < done,
    })),
  });
}
seedProcess('ONBOARDING', '61', 6);
seedProcess('ONBOARDING', '62', 4);
seedProcess('ONBOARDING', '63', 2);
seedProcess('ONBOARDING', '64', 0);
seedProcess('OFFBOARDING', '6', 5, 3);
seedProcess('OFFBOARDING', '23', 2, 18);
seedProcess('OFFBOARDING', '40', 0, 27);

// ---------- notifications ----------
notify(
  '7',
  'LEAVE_APPROVED',
  'Leave approved',
  'Your Sick Leave request was approved.',
  '/me/leave',
  60 * 30,
);
notify(
  '7',
  'REGULARIZATION_APPROVED',
  'Regularization approved',
  'Your attendance request was approved.',
  '/me/attendance',
  60 * 52,
);
notify(
  '7',
  'PAYSLIP_AVAILABLE',
  'Payslip available',
  `Your payslip for ${monthLabel(format(subMonths(new Date(), 1), 'yyyy-MM'))} is ready.`,
  '/me/payslips',
  60 * 90,
);
notify(
  '1',
  'GENERAL',
  'Requests are waiting',
  'You have leave and attendance requests to review.',
  '/team/approvals',
  60 * 3,
);
notify(
  '2',
  'GENERAL',
  'Payroll ready for review',
  `Payroll for ${monthLabel(thisMonth)} is waiting for approval.`,
  '/payroll',
  60 * 5,
);

// ---------- reports ----------
function report(kind: ReportKind, p: (k: string) => string): ReportResponse | MockResult {
  const dept = p('departmentId');
  if (kind === 'headcount') {
    const rows = db.departments
      .filter((d) => !dept || d.id === dept)
      .map((d) => {
        const es = db.employees.filter(
          (e) => e.departmentId === d.id && (!p('branchId') || e.branchId === p('branchId')),
        );
        const c = (s: string) => es.filter((e) => e.status === s).length;
        return {
          department: d.name,
          active: c('ACTIVE'),
          onNotice: c('ON_NOTICE'),
          inactive: c('INACTIVE'),
          total: es.length,
        };
      });
    const t = (k: 'active' | 'onNotice' | 'inactive' | 'total') => sum(rows.map((r) => r[k]));
    return {
      columns: [
        { key: 'department', label: 'Department' },
        ...['active:Active', 'onNotice:On notice', 'inactive:Inactive', 'total:Total'].map((x) => ({
          key: x.split(':')[0],
          label: x.split(':')[1],
          numeric: true,
        })),
      ],
      rows,
      totals: {
        department: 'Total',
        active: t('active'),
        onNotice: t('onNotice'),
        inactive: t('inactive'),
        total: t('total'),
      },
    };
  }
  if (kind === 'attendance') {
    const from = p('from') || `${thisMonth}-01`,
      to = p('to') || iso(new Date());
    if (to < from) return fail(422, 'The end date must be on or after the start date.');
    const rows = db.departments
      .filter((d) => !dept || d.id === dept)
      .map((d) => {
        const es = db.employees.filter((e) => e.departmentId === d.id && e.status !== 'INACTIVE');
        const c = { PRESENT: 0, HALF_DAY: 0, ABSENT: 0, LEAVE: 0 };
        es.forEach((e) => {
          for (let x = parseISO(from); iso(x) <= to; x = addDays(x, 1)) {
            const s = attendanceFor(e, iso(x)).status;
            if (s && s in c) c[s as keyof typeof c]++;
          }
        });
        const worked = c.PRESENT + c.HALF_DAY + c.ABSENT + c.LEAVE;
        return {
          department: d.name,
          employees: es.length,
          present: c.PRESENT,
          halfDay: c.HALF_DAY,
          absent: c.ABSENT,
          leave: c.LEAVE,
          attendance: worked
            ? `${(((c.PRESENT + c.HALF_DAY * 0.5) / worked) * 100).toFixed(1)}%`
            : '—',
        };
      });
    return {
      columns: [
        { key: 'department', label: 'Department' },
        ...[
          'employees:Employees',
          'present:Present days',
          'halfDay:Half days',
          'absent:Absent days',
          'leave:Leave days',
        ].map((x) => ({ key: x.split(':')[0], label: x.split(':')[1], numeric: true })),
        { key: 'attendance', label: 'Attendance', numeric: true },
      ],
      rows,
      totals: null,
    };
  }
  if (kind === 'leave') {
    const from = p('from') || `${thisMonth.slice(0, 4)}-01-01`,
      to = p('to') || iso(new Date());
    const rows = db.leaveTypes
      .filter((t) => !p('leaveTypeId') || t.id === p('leaveTypeId'))
      .map((t) => {
        const ls = leaveStore.filter(
          (l) =>
            l.leaveTypeId === t.id &&
            l.fromDate >= from &&
            l.fromDate <= to &&
            (!dept || db.employees.find((e) => e.id === l.employeeId)?.departmentId === dept),
        );
        const days = (s: string) => sum(ls.filter((l) => l.status === s).map((l) => l.days));
        return {
          leaveType: t.name,
          requests: ls.length,
          approvedDays: days('APPROVED'),
          pendingDays: days('PENDING'),
          rejected: ls.filter((l) => l.status === 'REJECTED').length,
        };
      });
    return {
      columns: [
        { key: 'leaveType', label: 'Leave type' },
        ...[
          'requests:Requests',
          'approvedDays:Approved days',
          'pendingDays:Pending days',
          'rejected:Rejected',
        ].map((x) => ({ key: x.split(':')[0], label: x.split(':')[1], numeric: true })),
      ],
      rows,
      totals: null,
    };
  }
  const period =
    periods.find((x) => x.id === p('periodId')) ??
    [...periods].sort((a, b) => b.month.localeCompare(a.month))[0];
  const es = entriesFor(period).filter(
    (e) => !dept || nameOf(db.departments, dept) === e.departmentName,
  );
  const rows = db.departments
    .map((d) => d.name)
    .map((department) => {
      const x = es.filter((e) => e.departmentName === department);
      return {
        department,
        employees: x.length,
        gross: sum(x.map((e) => e.gross)),
        deductions: sum(x.map((e) => e.totalDeductions)),
        net: sum(x.map((e) => e.net)),
      };
    })
    .filter((r) => r.employees > 0);
  return {
    columns: [
      { key: 'department', label: 'Department' },
      { key: 'employees', label: 'Employees', numeric: true },
      { key: 'gross', label: 'Gross', numeric: true, money: true },
      { key: 'deductions', label: 'Deductions', numeric: true, money: true },
      { key: 'net', label: 'Net pay', numeric: true, money: true },
    ],
    rows,
    totals: {
      department: `Total (${monthLabel(period.month)})`,
      employees: sum(rows.map((r) => r.employees)),
      gross: sum(rows.map((r) => r.gross)),
      deductions: sum(rows.map((r) => r.deductions)),
      net: sum(rows.map((r) => r.net)),
    },
  };
}
const isMockResult = (x: ReportResponse | MockResult): x is MockResult => 'status' in x;
const blob = (text: string, type: string, name: string): MockResult =>
  ok(new Blob([text], { type }), 200, { 'content-disposition': `attachment; filename="${name}"` });

export function handleStage4(
  method: string,
  url: string,
  params: Record<string, unknown>,
  body: unknown,
  ctx: MockCtx | null,
): MockResult | null {
  const [a, b, c, d] = url.split('/').filter(Boolean);
  const s = (k: string) => (params[k] === undefined ? '' : String(params[k]));
  const need = (...roles: Role[]) =>
    !ctx
      ? fail(401, 'Not signed in.')
      : roles.includes(ctx.role)
        ? null
        : fail(403, 'You do not have permission to do this.');
  const HR = 'HR_ADMIN' as const;

  // payroll (HR only)
  if (a === 'payroll' && b === 'periods') {
    const denied = need(HR);
    if (denied) return denied;
    if (!c && method === 'get')
      return ok([...periods].sort((x, y) => y.month.localeCompare(x.month)).map(periodOut));
    if (!c && method === 'post') {
      const month = String((body as { month?: string })?.month ?? '');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail(422, 'Choose a valid month.');
      if (month > thisMonth)
        return fail(422, 'Payroll can only be run for the current or an earlier month.');
      if (periods.some((p) => p.month === month))
        return fail(409, `A payroll run for ${monthLabel(month)} already exists.`);
      const row: PeriodRow = { id: `p-${month}`, month, status: 'DRAFT' };
      periods.push(row);
      return ok(periodOut(row), 201);
    }
    const p = periods.find((x) => x.id === c);
    if (!p) return fail(404, 'Payroll period not found.');
    if (!d && method === 'get') return ok(periodDetail(p));
    if (d === 'entries' && method === 'get') {
      const q = s('search').toLowerCase();
      const deptName = s('departmentId') ? nameOf(db.departments, s('departmentId')) : '';
      return ok(
        paginate(
          entriesFor(p)
            .filter(
              (e) =>
                (!q || `${e.employeeCode} ${e.employeeName}`.toLowerCase().includes(q)) &&
                (!deptName || e.departmentName === deptName),
            )
            .sort((x, y) => x.employeeCode.localeCompare(y.employeeCode)),
          params,
        ),
      );
    }
    if (method === 'post' && (d === 'submit' || d === 'approve' || d === 'lock')) {
      const from: PayrollStatus =
        d === 'submit' ? 'DRAFT' : d === 'approve' ? 'IN_REVIEW' : 'APPROVED';
      if (p.status !== from)
        return fail(
          409,
          `Can’t ${d} a payroll run that is ${p.status.toLowerCase().replace('_', ' ')}.`,
        );
      p.status = d === 'submit' ? 'IN_REVIEW' : d === 'approve' ? 'APPROVED' : 'LOCKED';
      if (d === 'approve') {
        entriesFor(p);
        snapshots.set(p.id, entriesFor(p));
        eligible(p.month).forEach((e) =>
          notify(
            e.id,
            'PAYSLIP_AVAILABLE',
            'Payslip available',
            `Your payslip for ${monthLabel(p.month)} is ready.`,
            '/me/payslips',
          ),
        );
      }
      return ok(periodOut(p));
    }
  }

  // payslips
  if (a === 'me' && b === 'payslips') {
    const denied = need('EMPLOYEE', 'MANAGER');
    if (denied) return denied;
    const published = periods.filter((p) => p.status === 'APPROVED' || p.status === 'LOCKED');
    const mine = (month: string) =>
      entriesFor(published.find((p) => p.month === month)!).find(
        (e) => e.employeeId === ctx!.userId,
      );
    if (!c && method === 'get')
      return ok(
        published
          .filter((p) => mine(p.month))
          .sort((x, y) => y.month.localeCompare(x.month))
          .map((p) => {
            const e = mine(p.month)!;
            return {
              id: `ps-${p.month}`,
              month: p.month,
              gross: e.gross,
              net: e.net,
              publishedOn: lastDay(p.month),
            };
          }),
      );
    const month = (c ?? '').slice(3);
    if (!published.some((p) => p.month === month) || !mine(month))
      return fail(404, 'Payslip not found.');
    const e = mine(month)!;
    if (!d && method === 'get')
      return ok({ ...e, id: c, month, publishedOn: lastDay(month) } as Payslip);
    if (d === 'download' && method === 'get')
      return blob(
        `CIPL payslip (demo file)\n${e.employeeName} (${e.employeeCode})\n${monthLabel(month)}\nGross ${e.gross}\nDeductions ${e.totalDeductions}\nNet ${e.net}\n`,
        'text/plain',
        `payslip-${month}.txt`,
      );
  }

  // documents
  if (a === 'me' && b === 'documents') {
    const denied = need('EMPLOYEE', 'MANAGER');
    if (denied) return denied;
    if (!c && method === 'get')
      return ok(
        docs
          .filter((x) => x.employeeId === ctx!.userId)
          .sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt))
          .map(hydrateDoc),
      );
    if (!c && method === 'post') {
      const form = body instanceof FormData ? body : null;
      const file = form?.get('file');
      if (!(file instanceof File)) return fail(422, 'Choose a file to upload.');
      if (file.size > 5 * 1024 * 1024) return fail(422, 'The file is larger than 5 MB.');
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))
        return fail(422, 'Only PDF, JPG or PNG files are accepted.');
      const row: DocRow = {
        id: nextId(),
        employeeId: ctx!.userId,
        documentType: String(form?.get('documentType')) as DocumentType,
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        status: 'PENDING',
        reviewerComment: null,
      };
      docs.push(row);
      return ok(hydrateDoc(row), 201);
    }
    if (c && method === 'delete') {
      const row = docs.find((x) => x.id === c && x.employeeId === ctx!.userId);
      if (!row) return fail(404, 'Document not found.');
      if (row.status === 'VERIFIED')
        return fail(409, 'Verified documents can’t be deleted. Contact HR.');
      docs.splice(docs.indexOf(row), 1);
      return ok(null, 204);
    }
  }
  if (a === 'documents') {
    if (!ctx) return fail(401, 'Not signed in.');
    if (!b && method === 'get') {
      const denied = need(HR);
      if (denied) return denied;
      const q = s('search').toLowerCase();
      return ok(
        paginate(
          docs
            .map(hydrateDoc)
            .filter(
              (x) =>
                (!s('status') || x.status === s('status')) &&
                (!s('documentType') || x.documentType === s('documentType')) &&
                (!q ||
                  `${x.employeeCode} ${x.employeeName} ${x.fileName}`.toLowerCase().includes(q)),
            )
            .sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt)),
          params,
        ),
      );
    }
    const row = docs.find((x) => x.id === b);
    if (!row) return fail(404, 'Document not found.');
    if (c === 'file' && method === 'get') {
      if (ctx.role !== HR && row.employeeId !== ctx.userId)
        return fail(403, 'You do not have permission to open this document.');
      return blob(`Demo file: ${row.fileName}\n`, 'text/plain', row.fileName);
    }
    if (method === 'post' && (c === 'verify' || c === 'reject')) {
      const denied = need(HR);
      if (denied) return denied;
      if (row.status !== 'PENDING') return fail(409, 'This document has already been reviewed.');
      row.status = c === 'verify' ? 'VERIFIED' : 'REJECTED';
      row.reviewerComment = (body as { comment?: string })?.comment || null;
      notify(
        row.employeeId,
        'GENERAL',
        c === 'verify' ? 'Document verified' : 'Document rejected',
        `${row.fileName} was ${c === 'verify' ? 'verified' : 'rejected'} by HR.`,
        '/me/documents',
      );
      return ok(hydrateDoc(row));
    }
  }
  if (a === 'employees' && c === 'documents' && method === 'get') {
    const denied = need(HR);
    if (denied) return denied;
    return ok(
      docs
        .filter((x) => x.employeeId === b)
        .sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt))
        .map(hydrateDoc),
    );
  }

  // onboarding / offboarding (HR)
  if (a === 'onboarding' || a === 'offboarding') {
    const denied = need(HR);
    if (denied) return denied;
    const kind = a === 'onboarding' ? 'ONBOARDING' : 'OFFBOARDING';
    if (!b && method === 'get') return ok(processes.filter((x) => x.kind === kind));
    const proc = processes.find((x) => x.id === b && x.kind === kind);
    if (!proc) return fail(404, 'Record not found.');
    if (c === 'items' && method === 'post' && url.endsWith('/complete')) {
      const item = proc.items.find((x) => x.id === d);
      if (!item) return fail(404, 'Checklist item not found.');
      item.done = true;
      if (proc.items.every((x) => x.done)) proc.status = 'COMPLETED';
      return ok(proc);
    }
  }

  // notifications
  if (a === 'notifications') {
    if (!ctx) return fail(401, 'Not signed in.');
    const mine = notifStore.filter((n) => n.userId === ctx.userId);
    if (!b && method === 'get')
      return ok({
        items: [...mine]
          .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
          .slice(0, Number(s('limit')) || 20)
          .map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            createdAt: n.createdAt,
            read: n.read,
            href: n.href,
          })),
        unreadCount: mine.filter((n) => !n.read).length,
      });
    if (b === 'read-all' && method === 'post') {
      mine.forEach((n) => {
        n.read = true;
      });
      return ok(null, 204);
    }
    if (c === 'read' && method === 'post') {
      const n = mine.find((x) => x.id === b);
      if (!n) return fail(404, 'Notification not found.');
      n.read = true;
      return ok(null, 204);
    }
  }

  // reports (HR)
  if (a === 'reports' && ['headcount', 'attendance', 'leave', 'payroll'].includes(b)) {
    const denied = need(HR);
    if (denied) return denied;
    const out = report(b as ReportKind, s);
    if (isMockResult(out)) return out;
    if (!c && method === 'get') return ok(out);
    if (c === 'export' && method === 'get') {
      if (s('format') !== 'csv')
        return fail(501, 'Excel export isn’t available on the server yet. Use CSV.');
      const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = [
        out.columns.map((x) => esc(x.label)).join(','),
        ...[...out.rows, ...(out.totals ? [out.totals] : [])].map((r) =>
          out.columns.map((x) => esc(r[x.key] ?? '')).join(','),
        ),
      ];
      return blob(lines.join('\n'), 'text/csv', `${b}-report.csv`);
    }
  }
  return null;
}
