// @vitest-environment node
// Live check against a running backend (seeded). Skipped unless LIVE_API=1:
//   LIVE_API=1 npx vitest run src/lib/backend/live.test.ts
import { describe, expect, it, beforeAll } from 'vitest';

const live = process.env.LIVE_API ? describe : describe.skip;

live('frontend contract served by the real backend', () => {
  let apis: typeof import('../api/index-for-tests');
  const jar = new Map<string, string>();

  beforeAll(async () => {
    const { raw } = await import('./http');
    const { installBackendAdapter } = await import('./adapter');
    // Node has no browser cookie jar: emulate what the browser does (cookies + CSRF header + Origin).
    raw.interceptors.request.use((cfg) => {
      cfg.headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
      if (jar.get('cipl_csrf')) cfg.headers.set('X-CSRF-Token', jar.get('cipl_csrf')!);
      cfg.headers.set('Origin', 'http://localhost:3000');
      return cfg;
    });
    raw.interceptors.response.use((res) => {
      for (const c of (res.headers['set-cookie'] as unknown as string[] | undefined) ?? []) {
        const [kv] = c.split(';');
        const i = kv.indexOf('=');
        jar.set(kv.slice(0, i), kv.slice(i + 1));
      }
      return res;
    });
    installBackendAdapter();
    apis = (await import('../api/index-for-tests')) as typeof apis;
  });

  const as = async (email: string) => {
    jar.clear();
    await new Promise((r) => setTimeout(r, 300));
    return apis.authApi.login({ email, password: 'SeedOnly!Cipl2026' });
  };

  it('HR: login, directory, org and employees', async () => {
    const user = await as('hr@cipl.example');
    expect(user.role).toBe('HR_ADMIN');
    const depts = await apis.departmentsApi.list();
    expect(depts.length).toBeGreaterThan(0);
    expect(depts[0]).toHaveProperty('code');
    const shifts = await apis.shiftsApi.list();
    expect(shifts[0].startTime).toMatch(/^\d\d:\d\d$/);
    const list = await apis.employeesApi.list({ page: 1, pageSize: 5, sort: 'name', order: 'asc' });
    expect(list.meta.total).toBeGreaterThanOrEqual(20);
    expect(list.data).toHaveLength(5);
    expect(list.data[0].departmentName).toBeTruthy();
    const one = await apis.employeesApi.get(list.data[1].id);
    expect(one.employeeCode).toBe(list.data[1].employeeCode);
  });

  it('HR: dashboard, attendance, leave, reports', async () => {
    await as('hr@cipl.example');
    const dash = await apis.dashboardApi.hr();
    expect(dash.totalEmployees).toBeGreaterThanOrEqual(20);
    expect(dash.attendanceSummary).toHaveLength(7);
    const month = new Date().toISOString().slice(0, 7);
    const m = await apis.attendanceApi.monthly({ month, page: 1, pageSize: 3 });
    expect(m.data).toHaveLength(3);
    expect(m.data[0].days).toHaveLength(m.daysInMonth);
    const d = await apis.attendanceApi.daily({
      date: new Date().toISOString().slice(0, 10),
      page: 1,
      pageSize: 5,
    });
    expect(d.meta.total).toBeGreaterThanOrEqual(20);
    const lr = await apis.leaveApi.requests({ page: 1, pageSize: 5 });
    expect(lr.meta).toBeDefined();
    for (const kind of ['headcount', 'attendance', 'leave', 'payroll'] as const) {
      const r = await apis.reportsApi.get(kind, { from: `${month}-01` });
      expect(r.columns.length).toBeGreaterThan(0);
    }
    const csv = await apis.reportsApi.export('headcount', 'csv', {});
    expect(csv.filename).toContain('.csv');
    await expect(apis.reportsApi.export('headcount', 'xlsx', {})).rejects.toThrow();
    const types = await apis.leaveTypesApi.list();
    expect(types.find((t) => t.code === 'CL')?.annualDays).toBe('12');
  });

  it('Employee: self-service', async () => {
    const user = await as('employee02@cipl.example');
    expect(user.role).toBe('EMPLOYEE');
    const month = new Date().toISOString().slice(0, 7);
    const att = await apis.attendanceApi.mine(month);
    expect(att.days.length).toBeGreaterThan(27);
    const bal = await apis.leaveApi.balances();
    expect(bal.length).toBeGreaterThan(0);
    const types = await apis.leaveTypesApi.list();
    const cl = types.find((t) => t.code === 'CL')!;
    const prev = await apis.leaveApi.preview({
      leaveTypeId: cl.id,
      fromDate: '2026-12-07',
      toDate: '2026-12-09',
    });
    expect(prev.days).toBe(3);
    const req = await apis.leaveApi.apply({
      leaveTypeId: cl.id,
      fromDate: '2026-12-07',
      toDate: '2026-12-09',
      reason: 'Family event',
    });
    expect(req.status).toBe('PENDING');
    const mine = await apis.leaveApi.mine();
    expect(mine.some((r) => r.id === req.id)).toBe(true);
    await apis.leaveApi.cancel(req.id);
    expect((await apis.leaveApi.mine()).find((r) => r.id === req.id)?.status).toBe('CANCELLED');
    const notes = await apis.notificationsApi.list();
    expect(notes).toHaveProperty('unreadCount');
    expect(await apis.documentsApi.mine()).toEqual(expect.any(Array));
    expect(await apis.payrollApi.payslips()).toEqual(expect.any(Array));
  });

  it('HR: write flows (org, employee, payroll, onboarding)', async () => {
    await as('admin@cipl.example');
    const tag = String(Date.now()).slice(-5);
    const d = await apis.departmentsApi.create({ name: `Dept ${tag}`, code: `D${tag}` });
    expect(d.id).toBeTruthy();
    await apis.departmentsApi.update(d.id, { name: `Dept ${tag} renamed` });
    await apis.departmentsApi.remove(d.id);
    expect((await apis.departmentsApi.list()).some((x) => x.id === d.id)).toBe(false);
    const des = await apis.designationsApi.create({ name: `Role ${tag}` });
    expect(des.id).toBeTruthy();
    const sh = await apis.shiftsApi.create({
      name: `Shift ${tag}`,
      startTime: '10:00',
      endTime: '19:00',
    });
    expect(sh.startTime).toBe('10:00');
    const hol = await apis.holidaysApi.create({
      name: `Hol ${tag}`,
      date: '2027-03-0' + (1 + (Number(tag) % 8)),
      type: 'PUBLIC',
    });
    const hol2 = await apis.holidaysApi.update(hol.id, {
      name: `Hol ${tag} b`,
      date: hol.date,
      type: 'PUBLIC',
    });
    expect(hol2.name).toContain('b');
    await apis.holidaysApi.remove(hol2.id);
    const lt = await apis.leaveTypesApi.create({
      name: `LT ${tag}`,
      code: `LT${tag}`,
      annualDays: '5',
      paid: 'PAID',
    });
    expect(lt.annualDays).toBe('5');

    const depts = await apis.departmentsApi.list();
    const branches = await apis.branchesApi.list();
    const shifts = await apis.shiftsApi.list();
    const desigs = await apis.designationsApi.list();
    const input = {
      employeeCode: `TST${tag}`,
      firstName: 'Test',
      lastName: 'Person',
      email: `test${tag}@cipl.example`,
      phone: '9876543210',
      dateOfBirth: '1992-04-05',
      gender: 'FEMALE' as const,
      departmentId: depts[0].id,
      designationId: desigs[0].id,
      branchId: branches[0].id,
      shiftId: shifts[0].id,
      managerId: null,
      joiningDate: '2026-09-15',
      status: 'ACTIVE' as const,
      address: '12 MG Road, Pune, Maharashtra, 411001',
      emergencyContactName: 'Asha Person',
      emergencyContactPhone: '9123456780',
    };
    const e = await apis.employeesApi.create(input);
    expect(e.address).toBe('12 MG Road, Pune, Maharashtra, 411001');
    expect(e.gender).toBe('FEMALE');
    const e2 = await apis.employeesApi.update(e.id, {
      ...input,
      firstName: 'Tester',
      status: 'ON_NOTICE' as const,
    });
    expect(e2.firstName).toBe('Tester');
    expect(e2.status).toBe('ON_NOTICE');
    await expect(
      apis.employeesApi.create({
        ...input,
        employeeCode: `TSX${tag}`,
        email: `x${tag}@cipl.example`,
        address: 'nowhere',
      }),
    ).rejects.toThrow();

    const ob = await apis.processApi.list('onboarding');
    expect(ob.length).toBeGreaterThanOrEqual(0);
  });

  it('Payroll: run lifecycle and payslip', async () => {
    await as('hr@cipl.example');
    const periods = await apis.payrollApi.periods();
    let p = periods.find((x) => x.month === '2026-09');
    if (!p) p = await apis.payrollApi.createRun('2026-09');
    expect(p.status).toBeDefined();
    if (p.status === 'DRAFT') p = await apis.payrollApi.act(p.id, 'submit');
    const detail = await apis.payrollApi.period(p.id);
    expect(detail.departmentSummary.length).toBeGreaterThan(0);
    const entries = await apis.payrollApi.entries(p.id, { page: 1, pageSize: 5 });
    expect(entries.data[0].net).toBeGreaterThan(0);
    expect(entries.data[0].statutory).toBeDefined();
    // approval must be by a different user than the processor
    await as('admin@cipl.example');
    if (p.status === 'IN_REVIEW') p = await apis.payrollApi.act(p.id, 'approve');
    if (p.status === 'APPROVED') p = await apis.payrollApi.act(p.id, 'lock');
    expect(p.status).toBe('LOCKED');
    // employees can now read their own payslip
    const emp = entries.data[0];
    const email = `employee${emp.employeeCode.slice(-2)}@cipl.example`;
    await as(email);
    const slips = await apis.payrollApi.payslips();
    expect(slips.length).toBe(1);
    const slip = await apis.payrollApi.payslip(slips[0].id);
    expect(slip.net).toBeGreaterThan(0);
    const file = await apis.payrollApi.downloadPayslip(slips[0].id, slip.month);
    expect(file.filename).toContain('payslip');
  });

  it('Employee: documents and regularization', async () => {
    await as('employee03@cipl.example');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const file = new File([png], 'id.png', { type: 'image/png' });
    const doc = await apis.documentsApi.upload(file, 'ID_PROOF');
    expect(doc.documentType).toBe('ID_PROOF');
    expect((await apis.documentsApi.mine()).some((d) => d.id === doc.id)).toBe(true);
    const before = (await apis.attendanceApi.myRegularizations()).length;
    const reg = await apis.attendanceApi.requestRegularization({
      date: '2026-10-02',
      requestedCheckIn: '09:00',
      requestedCheckOut: '18:00',
      reason: 'Forgot to punch',
    });
    expect(reg.status).toBe('PENDING');
    expect((await apis.attendanceApi.myRegularizations()).length).toBe(before + 1);
    await as('employee01@cipl.example');
    const team = await apis.attendanceApi.teamRegularizations('PENDING');
    const mine = team.find((r) => r.id === reg.id);
    expect(mine).toBeDefined();
    const done = await apis.attendanceApi.decide(reg.id, 'approve', 'ok');
    expect(done.status).toBe('APPROVED');
  });

  it('Manager: team views and approvals', async () => {
    const user = await as('employee01@cipl.example');
    expect(user.role).toBe('MANAGER');
    const members = await apis.attendanceApi.teamMembers();
    expect(members).toHaveLength(19);
    const team = await apis.attendanceApi.teamDaily({
      date: new Date().toISOString().slice(0, 10),
      page: 1,
      pageSize: 5,
    });
    expect(team.meta.total).toBe(19);
    const pending = await apis.leaveApi.teamRequests({ status: 'PENDING', page: 1, pageSize: 5 });
    expect(pending.meta).toBeDefined();
  });
});
