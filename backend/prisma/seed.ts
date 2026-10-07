import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { loadEnv } from '../src/config/env.js';
import { calculateAttendance } from '../src/attendance/calculator.js';
import { dateOnly, datesBetween, shiftTimes } from '../src/common/dates.js';
import bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
const permissions = [
  'organization.view',
  'organization.manage',
  'users.manage',
  'roles.manage',
  'employee.view',
  'employee.create',
  'employee.update',
  'employee.deactivate',
  'employee.profile',
  'employee.bank',
  'attendance.view',
  'attendance.punch',
  'attendance.manage',
  'attendance.regularize',
  'attendance.approve',
  'leave.view',
  'leave.request',
  'leave.approve',
  'leave.manage',
  'payroll.view',
  'payroll.process',
  'payroll.approve',
  'salary.manage',
  'payslip.view',
  'documents.view',
  'documents.upload',
  'documents.manage',
  'lifecycle.manage',
  'reports.view',
  'reports.export',
  'audit.view',
];
const basic = [
  'organization.view',
  'employee.view',
  'employee.profile',
  'employee.bank',
  'attendance.view',
  'attendance.punch',
  'attendance.regularize',
  'leave.view',
  'leave.request',
  'documents.view',
  'documents.upload',
  'payslip.view',
];
const roles: Record<string, string[]> = {
  SUPER_ADMIN: permissions,
  HR_ADMIN: permissions.filter((p) => !['users.manage', 'roles.manage'].includes(p)),
  HR_EXECUTIVE: [
    ...basic,
    'organization.manage',
    'employee.create',
    'employee.update',
    'employee.deactivate',
    'attendance.manage',
    'attendance.approve',
    'leave.approve',
    'leave.manage',
    'documents.manage',
    'lifecycle.manage',
    'reports.view',
    'reports.export',
  ],
  MANAGER: [...basic, 'attendance.approve', 'leave.approve', 'reports.view'],
  EMPLOYEE: basic,
};
export async function seed(db: PrismaClient, password = 'SeedOnly!Cipl2026') {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development seed is disabled in production');
  const passwordHash = await bcrypt.hash(password, 12);
  for (const code of permissions)
    await db.permission.upsert({ where: { code }, create: { code }, update: {} });
  for (const [name, codes] of Object.entries(roles)) {
    const role = await db.role.upsert({ where: { name }, create: { name }, update: {} });
    const records = await db.permission.findMany({ where: { code: { in: codes } } });
    await db.rolePermission.createMany({
      data: records.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  const allRoles = await db.role.findMany();
  for (const [email, role] of [
    ['admin@cipl.example', 'SUPER_ADMIN'],
    ['hr@cipl.example', 'HR_ADMIN'],
  ])
    await db.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        roles: { create: { roleId: allRoles.find((r) => r.name === role)!.id } },
      },
      update: {},
    });
  const branches = [];
  for (const [name, code] of [
    ['Delhi Office', 'DEL'],
    ['Noida Office', 'NOI'],
  ])
    branches.push(await db.branch.upsert({ where: { code }, create: { name, code }, update: {} }));
  const departments = [];
  for (const [name, code] of [
    ['Engineering', 'ENG'],
    ['Operations', 'OPS'],
    ['Human Resources', 'HR'],
    ['Finance', 'FIN'],
  ])
    departments.push(
      await db.department.upsert({ where: { code }, create: { name, code }, update: {} }),
    );
  const designations = [];
  for (const [name, code] of [
    ['Engineer', 'ENGINEER'],
    ['Executive', 'EXEC'],
    ['Team Lead', 'LEAD'],
  ])
    designations.push(
      await db.designation.upsert({ where: { code }, create: { name, code }, update: {} }),
    );
  const day = await db.shift.upsert({
    where: { name: 'General 09:00–18:00' },
    create: {
      name: 'General 09:00–18:00',
      startMinute: 540,
      endMinute: 1080,
      fullDayMinutes: 480,
      halfDayMinutes: 240,
      weeklyOff: [6, 7],
    },
    update: {},
  });
  await db.shift.upsert({
    where: { name: 'Night 22:00–06:00' },
    create: { name: 'Night 22:00–06:00', startMinute: 1320, endMinute: 360, weeklyOff: [7] },
    update: {},
  });
  const now = new Date(),
    year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, now.getUTCMonth() - 1, 1)),
    end = new Date(Date.UTC(year, now.getUTCMonth(), 0));
  const attendanceYear = start.getUTCFullYear();
  const employees: Array<{ id: string; joiningDate: Date; branchId: string }> = [];
  for (let i = 1; i <= 20; i++) {
    const code = `CIPL${String(i).padStart(4, '0')}`,
      email = `employee${String(i).padStart(2, '0')}@cipl.example`,
      managerId = i === 1 ? undefined : employees[0]?.id;
    const e = await db.employee.upsert({
      where: { employeeCode: code },
      create: {
        employeeCode: code,
        firstName: [
          'Aarav',
          'Diya',
          'Kabir',
          'Mira',
          'Ishaan',
          'Anaya',
          'Rohan',
          'Tara',
          'Vivaan',
          'Nisha',
        ][(i - 1) % 10],
        lastName: `Demo${i}`,
        email,
        departmentId: departments[(i - 1) % 4].id,
        designationId: designations[i === 1 ? 2 : i % 2].id,
        branchId: branches[i % 2].id,
        shiftId: day.id,
        managerId,
        joiningDate: dateOnly(`${attendanceYear}-01-01`),
        employment: { create: { employmentType: 'FULL_TIME' } },
      },
      update: {},
    });
    employees.push(e);
    const role = i === 1 ? 'MANAGER' : i === 20 ? 'HR_EXECUTIVE' : 'EMPLOYEE';
    await db.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        employeeId: e.id,
        roles: { create: { roleId: allRoles.find((r) => r.name === role)!.id } },
      },
      update: {},
    });
  }
  const types: Array<{ id: string }> = [];
  for (const [code, name, paid, days] of [
    ['CL', 'Casual Leave', true, '12'],
    ['SL', 'Sick Leave', true, '12'],
    ['EL', 'Earned Leave', true, '18'],
    ['LWP', 'Leave Without Pay', false, '0'],
  ] as const) {
    const t = await db.leaveType.upsert({
      where: { code },
      create: { code, name, paid },
      update: {},
    });
    types.push(t);
    for (const y of new Set([year, attendanceYear])) {
      await db.leavePolicy.upsert({
        where: { leaveTypeId_year: { leaveTypeId: t.id, year: y } },
        create: {
          leaveTypeId: t.id,
          year: y,
          annualEntitlement: days,
          carryForwardLimit: code === 'EL' ? '5' : '0',
        },
        update: {},
      });
      if (paid)
        for (const e of employees)
          await db.leaveBalance.upsert({
            where: {
              employeeId_leaveTypeId_year: { employeeId: e.id, leaveTypeId: t.id, year: y },
            },
            create: { employeeId: e.id, leaveTypeId: t.id, year: y, entitled: days },
            update: {},
          });
    }
  }
  for (const [name, date] of [
    ['Republic Day', `${year}-01-26`],
    ['Independence Day', `${year}-08-15`],
    ['Demo branch holiday', `${year}-10-02`],
  ]) {
    if (!(await db.holiday.findFirst({ where: { name, date: dateOnly(date) } })))
      await db.holiday.create({ data: { name, date: dateOnly(date) } });
  }
  const components = [];
  for (const [code, name, kind, statutory] of [
    ['BASIC', 'Basic salary', 'EARNING', false],
    ['HRA', 'House rent allowance', 'EARNING', false],
    ['PF', 'Provident fund', 'DEDUCTION', true],
    ['ESI', 'Employee state insurance', 'DEDUCTION', true],
    ['TDS', 'Tax deducted at source', 'DEDUCTION', true],
    ['PT', 'Professional tax', 'DEDUCTION', true],
    ['GRATUITY', 'Gratuity provision', 'EMPLOYER', true],
  ] as const)
    components.push(
      await db.salaryComponent.upsert({
        where: { code },
        create: { code, name, kind, statutory },
        update: {},
      }),
    );
  let structure = await db.salaryStructure.findUnique({
    where: { name_version: { name: 'Demo monthly salary', version: 1 } },
  });
  if (!structure)
    structure = await db.salaryStructure.create({
      data: {
        name: 'Demo monthly salary',
        version: 1,
        effectiveFrom: dateOnly(`${attendanceYear}-01-01`),
        rules: {
          create: components.map((c) => ({
            componentId: c.id,
            method: 'FIXED',
            value: c.code === 'BASIC' ? '30000' : c.code === 'HRA' ? '10000' : '0',
            prorate: !c.statutory,
          })),
        },
      },
    });
  for (const e of employees) {
    await db.employeeSalaryStructure.upsert({
      where: { employeeId_effectiveFrom: { employeeId: e.id, effectiveFrom: e.joiningDate } },
      create: { employeeId: e.id, structureId: structure.id, effectiveFrom: e.joiningDate },
      update: {},
    });
    for (const date of datesBetween(start, end, 31)) {
      const times = shiftTimes(date, day.startMinute, day.endMinute, 'Asia/Kolkata');
      const holiday = !!(await db.holiday.findFirst({
        where: { date, OR: [{ branchId: null }, { branchId: e.branchId }] },
      }));
      const off = day.weeklyOff.includes(date.getUTCDay() === 0 ? 7 : date.getUTCDay());
      const punches =
        off || holiday
          ? []
          : [
              { occurredAt: times.start, direction: 'IN' },
              { occurredAt: times.end, direction: 'OUT' },
            ];
      const result = calculateAttendance(date, day, punches, 'Asia/Kolkata', holiday);
      await db.attendance.upsert({
        where: { employeeId_date: { employeeId: e.id, date } },
        create: { employeeId: e.id, date, ...result, source: 'DEVELOPMENT_SEED' },
        update: {},
      });
    }
  }
  const sampleDate = new Date(Date.UTC(year, now.getUTCMonth() + 1, 5));
  while ([0, 6].includes(sampleDate.getUTCDay()))
    sampleDate.setUTCDate(sampleDate.getUTCDate() + 1);
  if (
    !(await db.leaveRequest.findFirst({
      where: { employeeId: employees[1].id, reason: 'Development seed: personal appointment' },
    }))
  ) {
    await db.$transaction(async (tx) => {
      await tx.leaveRequest.create({
        data: {
          employeeId: employees[1].id,
          leaveTypeId: types[0].id,
          startDate: sampleDate,
          endDate: sampleDate,
          days: '1',
          dates: [sampleDate.toISOString().slice(0, 10)],
          reason: 'Development seed: personal appointment',
        },
      });
      await tx.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: employees[1].id,
            leaveTypeId: types[0].id,
            year: sampleDate.getUTCFullYear(),
          },
        },
        data: { reserved: { increment: '1' } },
      });
    });
  }
  return { employees: employees.length, attendanceMonth: isoMonth(start) };
}
function isoMonth(date: Date) {
  return date.toISOString().slice(0, 7);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    console.log('Seed completed', await seed(db, process.env.SEED_PASSWORD));
  } finally {
    await db.$disconnect();
  }
}
