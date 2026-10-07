import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ScopeService, isHR } from '../common/scope.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import type { Principal } from '../auth/auth.types.js';
import { RangeQuery, ReviewDto, pageArgs, paged } from '../common/dto.js';
import { dateOnly, datesBetween, isoDate } from '../common/dates.js';
import { assertPeriodEditable } from '../common/business-lock.js';
import {
  AllocateLeaveDto,
  LeavePolicyDto,
  LeaveRequestDto,
  LeaveTypeDto,
  LeaveTypeUpdateDto,
} from './leave.dto.js';
@Injectable()
export class LeaveService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    private notify: NotificationsService,
    private attendance: AttendanceService,
  ) {}
  async types() {
    return {
      items: await this.db.leaveType.findMany({
        include: { policies: true },
        orderBy: { name: 'asc' },
      }),
    };
  }
  typeCreate(u: Principal, d: LeaveTypeDto) {
    return this.db.atomic(async (tx) => {
      const row = await tx.leaveType.create({ data: d });
      await this.audit.write(tx, u.id, 'leave.type_created', 'LeaveType', row.id, undefined, row);
      return row;
    });
  }
  typeUpdate(u: Principal, id: string, d: LeaveTypeUpdateDto) {
    return this.db.atomic(async (tx) => {
      const old = await tx.leaveType.findUniqueOrThrow({ where: { id } });
      if (
        d.paid !== undefined &&
        d.paid !== old.paid &&
        (await tx.leaveRequest.count({ where: { leaveTypeId: id } }))
      )
        throw new ConflictException('Create a new leave type to change paid treatment');
      const row = await tx.leaveType.update({ where: { id }, data: d });
      await this.audit.write(tx, u.id, 'leave.type_updated', 'LeaveType', id, old, row);
      return row;
    });
  }
  policy(u: Principal, d: LeavePolicyDto) {
    return this.db.atomic(async (tx) => {
      const row = await tx.leavePolicy.create({ data: d });
      await this.audit.write(
        tx,
        u.id,
        'leave.policy_created',
        'LeavePolicy',
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }
  allocate(u: Principal, d: AllocateLeaveDto) {
    return this.db.atomic(async (tx) => {
      const employees = await tx.employee.findMany({
        where: { id: d.employeeId, status: { in: ['ACTIVE', 'NOTICE_PERIOD'] } },
      });
      const policies = await tx.leavePolicy.findMany({
        where: { year: d.year, leaveType: { active: true, paid: true } },
      });
      if (!policies.length) throw new BadRequestException('No paid leave policies for this year');
      let created = 0;
      for (const e of employees)
        for (const p of policies) {
          const previous = await tx.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: e.id,
                leaveTypeId: p.leaveTypeId,
                year: d.year - 1,
              },
            },
          });
          const carry = previous
            ? Prisma.Decimal.min(
                Prisma.Decimal.max(
                  previous.entitled.minus(previous.used).minus(previous.reserved),
                  0,
                ),
                p.carryForwardLimit,
              )
            : new Prisma.Decimal(0);
          const result = await tx.leaveBalance.createMany({
            data: [
              {
                employeeId: e.id,
                leaveTypeId: p.leaveTypeId,
                year: d.year,
                entitled: p.annualEntitlement.plus(carry),
              },
            ],
            skipDuplicates: true,
          });
          created += result.count;
        }
      await this.audit.write(
        tx,
        u.id,
        'leave.balances_allocated',
        'LeaveBalance',
        String(d.year),
        undefined,
        { created, employeeId: d.employeeId },
      );
      return { created };
    });
  }
  async balances(u: Principal, q: RangeQuery) {
    const where = { employee: this.scope.filter(u), employeeId: q.employeeId };
    const [items, total] = await this.db.$transaction([
      this.db.leaveBalance.findMany({
        where,
        include: { leaveType: true },
        ...pageArgs(q),
        orderBy: [{ year: 'desc' }, { id: 'asc' }],
      }),
      this.db.leaveBalance.count({ where }),
    ]);
    return paged(
      items.map((b) => ({
        ...b,
        available: b.entitled.minus(b.used).minus(b.reserved).toFixed(2),
      })),
      total,
      q,
    );
  }
  async list(u: Principal, q: RangeQuery) {
    const where: Prisma.LeaveRequestWhereInput = {
      employee: this.scope.filter(u),
      employeeId: q.employeeId,
      startDate: { lte: q.to ? dateOnly(q.to) : undefined },
      endDate: { gte: q.from ? dateOnly(q.from) : undefined },
    };
    const [items, total] = await this.db.$transaction([
      this.db.leaveRequest.findMany({
        where,
        include: { leaveType: true, approvals: true },
        ...pageArgs(q),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.leaveRequest.count({ where }),
    ]);
    return paged(items, total, q);
  }
  request(u: Principal, d: LeaveRequestDto) {
    if (!u.employeeId) throw new BadRequestException('Employee profile required');
    return this.db.atomic(async (tx) => {
      const e = await tx.employee.findUniqueOrThrow({
        where: { id: u.employeeId! },
        include: { shift: true },
      });
      if (!['ACTIVE', 'NOTICE_PERIOD'].includes(e.status))
        throw new ConflictException('Employee is not active');
      const start = dateOnly(d.startDate),
        end = dateOnly(d.endDate);
      if (start.getUTCFullYear() !== end.getUTCFullYear())
        throw new BadRequestException('Split cross-year leave into separate requests');
      const all = datesBetween(start, end);
      if (start < e.joiningDate || (e.lastWorkingDate && end > e.lastWorkingDate))
        throw new BadRequestException('Leave falls outside employment');
      await assertPeriodEditable(tx, start, end);
      const type = await tx.leaveType.findUnique({ where: { id: d.leaveTypeId } });
      if (!type?.active) throw new BadRequestException('Leave type is inactive or unknown');
      if (
        await tx.leaveRequest.findFirst({
          where: {
            employeeId: e.id,
            status: { in: ['PENDING', 'APPROVED'] },
            startDate: { lte: end },
            endDate: { gte: start },
          },
        })
      )
        throw new ConflictException('Leave overlaps an existing request');
      const holidays = await tx.holiday.findMany({
        where: {
          date: { gte: start, lte: end },
          OR: [{ branchId: null }, { branchId: e.branchId }],
        },
      });
      const dates = all.filter(
        (date) =>
          !e.shift.weeklyOff.includes(DateTime.fromJSDate(date, { zone: 'utc' }).weekday) &&
          !holidays.some((h) => h.date.getTime() === date.getTime()),
      );
      if (!dates.length) throw new BadRequestException('No working days in requested range');
      if (
        await tx.attendance.count({
          where: { employeeId: e.id, date: { in: dates }, workingMinutes: { gt: 0 } },
        })
      )
        throw new ConflictException('Leave conflicts with worked attendance');
      const days = new Prisma.Decimal(dates.length);
      if (type.paid) {
        const b = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: e.id,
              leaveTypeId: type.id,
              year: start.getUTCFullYear(),
            },
          },
        });
        if (!b || b.entitled.minus(b.used).minus(b.reserved).lt(days))
          throw new ConflictException('Insufficient available leave balance');
        await tx.leaveBalance.update({
          where: { id: b.id },
          data: { reserved: { increment: days } },
        });
      }
      const row = await tx.leaveRequest.create({
        data: {
          employeeId: e.id,
          leaveTypeId: type.id,
          startDate: start,
          endDate: end,
          days,
          dates: dates.map(isoDate),
          reason: d.reason,
        },
      });
      await this.audit.write(tx, u.id, 'leave.requested', 'LeaveRequest', row.id, undefined, {
        employeeId: e.id,
        startDate: start,
        endDate: end,
        days: days.toString(),
      });
      await this.notify.approvers(tx, e.id, 'leave.submitted', 'Leave request submitted', row.id);
      return row;
    });
  }
  review(u: Principal, id: string, d: ReviewDto) {
    return this.db.atomic(async (tx) => {
      const r = await tx.leaveRequest.findUniqueOrThrow({
        where: { id },
        include: { leaveType: true },
      });
      await this.scope.approve(u, r.employeeId, tx);
      if (r.status !== 'PENDING') throw new ConflictException('Request has already been reviewed');
      await assertPeriodEditable(tx, r.startDate, r.endDate);
      const dates = (r.dates as string[]).map(dateOnly);
      if (
        d.decision === 'APPROVED' &&
        (await tx.attendance.count({
          where: { employeeId: r.employeeId, date: { in: dates }, workingMinutes: { gt: 0 } },
        }))
      )
        throw new ConflictException('Leave conflicts with worked attendance');
      if (r.leaveType.paid)
        await tx.leaveBalance.update({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: r.employeeId,
              leaveTypeId: r.leaveTypeId,
              year: r.startDate.getUTCFullYear(),
            },
          },
          data: {
            reserved: { decrement: r.days },
            used: d.decision === 'APPROVED' ? { increment: r.days } : undefined,
          },
        });
      const row = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: d.decision,
          approvals: { create: { approverId: u.id, decision: d.decision, note: d.note } },
        },
        include: { leaveType: true, approvals: true },
      });
      if (d.decision === 'APPROVED')
        for (const date of dates)
          await tx.attendance.upsert({
            where: { employeeId_date: { employeeId: r.employeeId, date } },
            create: { employeeId: r.employeeId, date, status: 'LEAVE', source: 'LEAVE' },
            update: {
              status: 'LEAVE',
              source: 'LEAVE',
              checkIn: null,
              checkOut: null,
              workingMinutes: 0,
              lateMinutes: 0,
              earlyMinutes: 0,
              overtimeMinutes: 0,
            },
          });
      await this.audit.write(
        tx,
        u.id,
        `leave.${d.decision.toLowerCase()}`,
        'LeaveRequest',
        id,
        { status: r.status },
        { status: d.decision, days: r.days.toString() },
      );
      await this.notify.employee(
        tx,
        r.employeeId,
        'leave.reviewed',
        `Leave ${d.decision.toLowerCase()}`,
        id,
      );
      return row;
    });
  }
  cancel(u: Principal, id: string) {
    return this.db.atomic(async (tx) => {
      const r = await tx.leaveRequest.findUniqueOrThrow({
        where: { id },
        include: { leaveType: true },
      });
      if (!isHR(u) && r.employeeId !== u.employeeId) throw new ForbiddenException();
      if (!['PENDING', 'APPROVED'].includes(r.status))
        throw new ConflictException('Leave cannot be cancelled in its current state');
      if (!isHR(u) && r.status === 'APPROVED' && r.startDate < dateOnly(new Date()))
        throw new ConflictException('HR must cancel historical approved leave');
      await assertPeriodEditable(tx, r.startDate, r.endDate);
      if (r.leaveType.paid)
        await tx.leaveBalance.update({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: r.employeeId,
              leaveTypeId: r.leaveTypeId,
              year: r.startDate.getUTCFullYear(),
            },
          },
          data:
            r.status === 'APPROVED'
              ? { used: { decrement: r.days } }
              : { reserved: { decrement: r.days } },
        });
      const row = await tx.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
      if (r.status === 'APPROVED')
        for (const date of r.dates as string[])
          await this.attendance.recalculate(tx, r.employeeId, dateOnly(date));
      await this.audit.write(
        tx,
        u.id,
        'leave.cancelled',
        'LeaveRequest',
        id,
        { status: r.status },
        { status: 'CANCELLED' },
      );
      await this.notify.approvers(
        tx,
        r.employeeId,
        'leave.cancelled',
        'Leave request cancelled',
        id,
      );
      return row;
    });
  }
}
