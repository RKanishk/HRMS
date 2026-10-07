import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ENV, type Environment } from '../config/env.js';
import type { Principal } from '../auth/auth.types.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
import { datesBetween, isoDate, localDay } from '../common/dates.js';
import { calculatePayroll } from './calculator.js';
import { PayrollInputDto, PeriodDto } from './payroll.dto.js';
@Injectable()
export class PayrollService {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
    private notify: NotificationsService,
    @Inject(ENV) private env: Environment,
  ) {}
  async list(q: PageQuery) {
    const [items, total] = await this.db.$transaction([
      this.db.payrollRun.findMany({
        ...pageArgs(q),
        include: { period: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.payrollRun.count(),
    ]);
    return paged(items, total, q);
  }
  async get(id: string) {
    return this.db.payrollRun.findUniqueOrThrow({
      where: { id },
      include: {
        period: true,
        inputs: true,
        employees: { include: { components: true, payslip: true } },
      },
    });
  }
  create(u: Principal, d: PeriodDto) {
    return this.db.atomic(async (tx) => {
      const startDate = new Date(Date.UTC(d.year, d.month - 1, 1)),
        endDate = new Date(Date.UTC(d.year, d.month, 0));
      const period = await tx.payrollPeriod.create({ data: { ...d, startDate, endDate } });
      const row = await tx.payrollRun.create({
        data: { periodId: period.id },
        include: { period: true },
      });
      await this.audit.write(tx, u.id, 'payroll.opened', 'PayrollRun', row.id, undefined, {
        year: d.year,
        month: d.month,
      });
      return row;
    });
  }
  input(u: Principal, id: string, d: PayrollInputDto) {
    return this.db.atomic(async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id } });
      if (run.status !== 'OPEN') throw new ConflictException('Inputs require OPEN payroll');
      if (d.code === 'LOP') throw new BadRequestException('LOP is calculated from attendance');
      await tx.employee.findUniqueOrThrow({ where: { id: d.employeeId } });
      const row = await tx.payrollInput.upsert({
        where: { runId_employeeId_code: { runId: id, employeeId: d.employeeId, code: d.code } },
        create: { runId: id, ...d },
        update: { kind: d.kind, amount: d.amount, note: d.note },
      });
      await this.audit.write(
        tx,
        u.id,
        'payroll.input_saved',
        'PayrollInput',
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }
  process(u: Principal, id: string) {
    return this.db.atomic(async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({
        where: { id },
        include: { period: true, inputs: true },
      });
      if (run.status !== 'OPEN') throw new ConflictException('Only OPEN payroll may be processed');
      if (run.period.endDate >= localDay(new Date(), this.env.COMPANY_TIMEZONE))
        throw new BadRequestException('Payroll can only process a completed calendar month');
      await tx.payrollRun.update({ where: { id }, data: { status: 'CALCULATING' } });
      const employees = await tx.employee.findMany({
        where: {
          joiningDate: { lte: run.period.endDate },
          OR: [{ lastWorkingDate: null }, { lastWorkingDate: { gte: run.period.startDate } }],
          status: { not: 'INACTIVE' },
        },
        include: { shift: true, department: true, designation: true, branch: true },
      });
      if (!employees.length) throw new BadRequestException('No eligible employees');
      const calendar = datesBetween(run.period.startDate, run.period.endDate, 31);
      for (const input of run.inputs)
        if (!employees.some((e) => e.id === input.employeeId))
          throw new ConflictException('Variable input refers to an ineligible employee');
      for (const e of employees) {
        const dates = calendar.filter(
          (d) => d >= e.joiningDate && (!e.lastWorkingDate || d <= e.lastWorkingDate),
        );
        if (!dates.length) continue;
        const salary = await tx.employeeSalaryStructure.findFirst({
          where: { employeeId: e.id, effectiveFrom: { lte: dates[0] } },
          orderBy: { effectiveFrom: 'desc' },
          include: { structure: { include: { rules: { include: { component: true } } } } },
        });
        if (!salary) throw new ConflictException(`No salary assignment for ${e.employeeCode}`);
        if (
          await tx.employeeSalaryStructure.count({
            where: { employeeId: e.id, effectiveFrom: { gt: dates[0], lte: run.period.endDate } },
          })
        )
          throw new ConflictException('Mid-period salary changes are not supported');
        const records = await tx.attendance.findMany({
          where: { employeeId: e.id, date: { gte: dates[0], lte: dates.at(-1) } },
        });
        const holidays = await tx.holiday.findMany({
          where: {
            date: { gte: dates[0], lte: dates.at(-1) },
            OR: [{ branchId: null }, { branchId: e.branchId }],
          },
        });
        const leaves = await tx.leaveRequest.findMany({
          where: {
            employeeId: e.id,
            status: 'APPROVED',
            startDate: { lte: run.period.endDate },
            endDate: { gte: run.period.startDate },
          },
          include: { leaveType: true },
        });
        if (
          (await tx.leaveRequest.count({
            where: {
              employeeId: e.id,
              status: 'PENDING',
              startDate: { lte: run.period.endDate },
              endDate: { gte: run.period.startDate },
            },
          })) ||
          (await tx.attendanceRegularization.count({
            where: {
              employeeId: e.id,
              status: 'PENDING',
              date: { gte: run.period.startDate, lte: run.period.endDate },
            },
          }))
        )
          throw new ConflictException(`Pending attendance/leave approval for ${e.employeeCode}`);
        let lop = new Prisma.Decimal(0);
        for (const day of dates) {
          const a = records.find((r) => r.date.getTime() === day.getTime());
          if (a?.checkIn && !a.checkOut)
            throw new ConflictException(`Open punch for ${e.employeeCode} on ${isoDate(day)}`);
          if (
            holidays.some((h) => h.date.getTime() === day.getTime()) ||
            e.shift.weeklyOff.includes(DateTime.fromJSDate(day, { zone: 'utc' }).weekday)
          )
            continue;
          if (!a)
            throw new ConflictException(
              `Missing attendance for ${e.employeeCode} on ${isoDate(day)}`,
            );
          if (a.status === 'ABSENT') lop = lop.plus(1);
          else if (a.status === 'HALF_DAY') lop = lop.plus('0.5');
          else if (a.status === 'LEAVE') {
            const leave = leaves.find((l) => (l.dates as string[]).includes(isoDate(day)));
            if (!leave) throw new ConflictException('LEAVE attendance lacks an approved request');
            if (!leave.leaveType.paid) lop = lop.plus(1);
          } else if (['HOLIDAY', 'WEEKLY_OFF'].includes(a.status))
            throw new ConflictException('Attendance calendar is stale; recalculate');
        }
        const rules = salary.structure.rules.map((r) => ({
          code: r.component.code,
          name: r.component.name,
          kind: r.component.kind,
          method: r.method,
          value: r.value.toString(),
          prorate: r.prorate,
          wageCap: r.wageCap?.toString(),
          eligibilityGrossMax: r.eligibilityGrossMax?.toString(),
        }));
        const inputs = run.inputs
          .filter((i) => i.employeeId === e.id)
          .map((i) => ({ code: i.code, kind: i.kind, amount: i.amount.toString(), note: i.note }));
        const result = calculatePayroll(
          rules,
          calendar.length,
          dates.length,
          lop.toString(),
          inputs,
        );
        const { lines, ...money } = result;
        await tx.payrollEmployee.create({
          data: {
            runId: id,
            employeeId: e.id,
            ...money,
            snapshot: JSON.parse(
              JSON.stringify({
                employeeCode: e.employeeCode,
                name: `${e.firstName} ${e.lastName}`,
                department: e.department.name,
                designation: e.designation.name,
                branch: e.branch.name,
                period: { year: run.period.year, month: run.period.month },
                salaryStructure: {
                  id: salary.structureId,
                  name: salary.structure.name,
                  version: salary.structure.version,
                },
                calendarDays: calendar.length,
                eligibleDays: dates.length,
                timezone: this.env.COMPANY_TIMEZONE,
                calculationVersion: '1.0.0',
                attendance: records.map((a) => ({
                  date: isoDate(a.date),
                  status: a.status,
                  workingMinutes: a.workingMinutes,
                })),
                rules,
              }),
            ) as Prisma.InputJsonValue,
            components: { create: lines },
          },
        });
      }
      const row = await tx.payrollRun.update({
        where: { id },
        data: { status: 'REVIEW', processedBy: u.id },
        include: { period: true },
      });
      await this.audit.write(
        tx,
        u.id,
        'payroll.processed',
        'PayrollRun',
        id,
        { status: 'OPEN' },
        { status: 'REVIEW', employees: employees.length },
      );
      await this.notify.notify(
        tx,
        u.id,
        'payroll.processed',
        'Payroll ready for independent review',
        id,
      );
      return row;
    });
  }
  reopen(u: Principal, id: string) {
    return this.db.atomic(async (tx) => {
      const row = await tx.payrollRun.findUniqueOrThrow({ where: { id } });
      if (row.status !== 'REVIEW')
        throw new ConflictException('Only REVIEW payroll may be reopened');
      const snapshot = await tx.payrollEmployee.findMany({
        where: { runId: id },
        select: { employeeId: true, gross: true, deductions: true, net: true },
      });
      await tx.payrollEmployee.deleteMany({ where: { runId: id } });
      await tx.payrollRun.update({ where: { id }, data: { status: 'OPEN', processedBy: null } });
      await this.audit.write(
        tx,
        u.id,
        'payroll.reopened',
        'PayrollRun',
        id,
        { status: 'REVIEW', previousTotals: snapshot },
        { status: 'OPEN' },
      );
      return { message: 'Payroll reopened; previous totals retained in audit' };
    });
  }
  approve(u: Principal, id: string) {
    return this.db.atomic(async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id } });
      if (run.status !== 'REVIEW')
        throw new ConflictException('Only REVIEW payroll may be approved');
      if (run.processedBy === u.id)
        throw new ForbiddenException('Payroll processor cannot approve their own run');
      const row = await tx.payrollRun.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: u.id, approvedAt: new Date() },
        include: { period: true },
      });
      await this.audit.write(
        tx,
        u.id,
        'payroll.approved',
        'PayrollRun',
        id,
        { status: run.status },
        { status: row.status },
      );
      return row;
    });
  }
  lock(u: Principal, id: string) {
    return this.db.atomic(async (tx) => {
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id } });
      if (run.status !== 'APPROVED')
        throw new ConflictException('Only APPROVED payroll may be locked');
      const employees = await tx.payrollEmployee.findMany({ where: { runId: id } });
      for (const row of employees) {
        const slip = await tx.payslip.create({ data: { payrollEmployeeId: row.id } });
        await this.notify.employee(
          tx,
          row.employeeId,
          'payslip.available',
          'Payslip is available',
          slip.id,
        );
      }
      const row = await tx.payrollRun.update({
        where: { id },
        data: { status: 'LOCKED', lockedBy: u.id, lockedAt: new Date() },
        include: { period: true },
      });
      await this.audit.write(
        tx,
        u.id,
        'payroll.locked',
        'PayrollRun',
        id,
        { status: run.status },
        { status: row.status, payslips: employees.length },
      );
      return row;
    });
  }
}
