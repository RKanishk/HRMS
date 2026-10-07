import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeService } from '../common/scope.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ENV, type Environment } from '../config/env.js';
import type { Principal } from '../auth/auth.types.js';
import { RegularizationDto } from './attendance.dto.js';
import { RangeQuery, ReviewDto, paged, pageArgs } from '../common/dto.js';
import { dateOnly, localDay } from '../common/dates.js';
import { assertPeriodEditable } from '../common/business-lock.js';
import { AttendanceService } from './attendance.service.js';
// Approval and attendance replacement are committed in the same transaction.
@Injectable()
export class RegularizationService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    private notify: NotificationsService,
    private attendance: AttendanceService,
    @Inject(ENV) private env: Environment,
  ) {}
  async list(u: Principal, q: RangeQuery) {
    const where = {
      employee: this.scope.filter(u),
      employeeId: q.employeeId,
      date: { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined },
    };
    const [items, total] = await this.db.$transaction([
      this.db.attendanceRegularization.findMany({
        where,
        ...pageArgs(q),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.attendanceRegularization.count({ where }),
    ]);
    return paged(items, total, q);
  }
  request(u: Principal, d: RegularizationDto) {
    if (!u.employeeId) throw new BadRequestException('Employee account required');
    return this.db.atomic(async (tx) => {
      const e = await this.scope.employee(u, u.employeeId!, false, tx);
      if (!['ACTIVE', 'NOTICE_PERIOD'].includes(e.status))
        throw new ConflictException('Employee is not active');
      const date = dateOnly(d.date),
        checkIn = new Date(d.checkIn),
        checkOut = new Date(d.checkOut);
      if (
        checkOut <= checkIn ||
        checkOut.getTime() - checkIn.getTime() > 24 * 3600000 ||
        checkOut > new Date() ||
        date > localDay(new Date(), this.env.COMPANY_TIMEZONE)
      )
        throw new BadRequestException('Invalid correction interval');
      const shift = await tx.shift.findUniqueOrThrow({ where: { id: e.shiftId } });
      if (
        this.attendance.workday(checkIn, shift.startMinute, shift.endMinute).getTime() !==
        date.getTime()
      )
        throw new BadRequestException('Check-in does not belong to the attendance date');
      await assertPeriodEditable(tx, date);
      const row = await tx.attendanceRegularization.create({
        data: { employeeId: e.id, date, checkIn, checkOut, reason: d.reason },
      });
      await this.audit.write(
        tx,
        u.id,
        'attendance.regularization_requested',
        'AttendanceRegularization',
        row.id,
        undefined,
        { employeeId: e.id, date },
      );
      await this.notify.approvers(
        tx,
        e.id,
        'attendance.regularization_requested',
        'Attendance correction requested',
        row.id,
      );
      return row;
    });
  }
  review(u: Principal, id: string, d: ReviewDto) {
    return this.db.atomic(async (tx) => {
      const r = await tx.attendanceRegularization.findUniqueOrThrow({ where: { id } });
      await this.scope.approve(u, r.employeeId, tx);
      if (r.status !== 'PENDING') throw new ConflictException('Request has already been reviewed');
      await assertPeriodEditable(tx, r.date);
      if (d.decision === 'APPROVED') {
        const leave = await tx.leaveRequest.findFirst({
          where: {
            employeeId: r.employeeId,
            status: 'APPROVED',
            startDate: { lte: r.date },
            endDate: { gte: r.date },
          },
        });
        if (leave)
          throw new ConflictException('Cancel approved leave before correcting attendance');
        await this.attendance.recalculate(tx, r.employeeId, r.date, {
          checkIn: r.checkIn,
          checkOut: r.checkOut,
        });
      }
      const row = await tx.attendanceRegularization.update({
        where: { id },
        data: { status: d.decision, reviewerId: u.id, reviewNote: d.note, reviewedAt: new Date() },
      });
      await this.audit.write(
        tx,
        u.id,
        `attendance.regularization_${d.decision.toLowerCase()}`,
        'AttendanceRegularization',
        id,
        { status: r.status },
        { status: row.status, employeeId: r.employeeId, date: r.date },
      );
      await this.notify.employee(
        tx,
        r.employeeId,
        'attendance.regularization_reviewed',
        `Attendance correction ${d.decision.toLowerCase()}`,
        id,
      );
      return row;
    });
  }
}
