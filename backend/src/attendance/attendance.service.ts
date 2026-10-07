import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ScopeService, isHR } from '../common/scope.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ENV, type Environment } from '../config/env.js';
import type { Principal } from '../auth/auth.types.js';
import { AttendanceQuery, CalculateDto, PunchDto } from './attendance.dto.js';
import { calculateAttendance } from './calculator.js';
import { dateOnly, datesBetween, isoDate, localDay, shiftTimes } from '../common/dates.js';
import { pageArgs, paged } from '../common/dto.js';
import { assertPeriodEditable } from '../common/business-lock.js';
@Injectable()
export class AttendanceService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    @Inject(ENV) private env: Environment,
  ) {}
  async list(u: Principal, q: AttendanceQuery) {
    const where: Prisma.AttendanceWhereInput = {
      employee: this.scope.filter(u),
      employeeId: q.employeeId,
      status: q.status,
      date: { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined },
    };
    const [items, total] = await this.db.$transaction([
      this.db.attendance.findMany({
        where,
        ...pageArgs(q),
        orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      }),
      this.db.attendance.count({ where }),
    ]);
    return paged(items, total, q);
  }
  async punches(u: Principal, q: AttendanceQuery) {
    if (q.employeeId) await this.scope.employee(u, q.employeeId);
    const where: Prisma.RawPunchWhereInput = {
      employee: this.scope.filter(u),
      employeeId: q.employeeId,
      occurredAt: {
        gte: q.from ? dateOnly(q.from) : undefined,
        lt: q.to ? new Date(dateOnly(q.to).getTime() + 86400000) : undefined,
      },
    };
    const [items, total] = await this.db.$transaction([
      this.db.rawPunch.findMany({ where, ...pageArgs(q), orderBy: { occurredAt: 'desc' } }),
      this.db.rawPunch.count({ where }),
    ]);
    return paged(items, total, q);
  }
  workday(instant: Date, start: number, end: number) {
    let day = localDay(instant, this.env.COMPANY_TIMEZONE);
    const minute =
      DateTime.fromJSDate(instant).setZone(this.env.COMPANY_TIMEZONE).hour * 60 +
      DateTime.fromJSDate(instant).setZone(this.env.COMPANY_TIMEZONE).minute;
    if (end <= start && minute < end + 180) day = new Date(day.getTime() - 86400000);
    return day;
  }
  async recalculate(
    tx: Prisma.TransactionClient,
    employeeId: string,
    date: Date,
    override?: { checkIn: Date; checkOut: Date },
  ) {
    await assertPeriodEditable(tx, date);
    const e = await tx.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: { shift: true },
    });
    if (date < e.joiningDate || (e.lastWorkingDate && date > e.lastWorkingDate))
      throw new BadRequestException('Date is outside employment');
    const current = await tx.attendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    if (current?.source === 'REGULARIZATION' && !override) return current;
    const window = shiftTimes(
      date,
      e.shift.startMinute,
      e.shift.endMinute,
      this.env.COMPANY_TIMEZONE,
    );
    const dayStart = DateTime.fromISO(isoDate(date), { zone: this.env.COMPANY_TIMEZONE })
      .startOf('day')
      .toJSDate();
    const start =
      e.shift.endMinute <= e.shift.startMinute
        ? new Date(window.start.getTime() - 3 * 3600000)
        : dayStart;
    const end =
      e.shift.endMinute <= e.shift.startMinute
        ? new Date(window.end.getTime() + 3 * 3600000)
        : new Date(dayStart.getTime() + 86400000);
    const punches = override
      ? [
          { occurredAt: override.checkIn, direction: 'IN' },
          { occurredAt: override.checkOut, direction: 'OUT' },
        ]
      : await tx.rawPunch.findMany({
          where: { employeeId, occurredAt: { gte: start, lt: end } },
          orderBy: { occurredAt: 'asc' },
        });
    const holiday = !!(await tx.holiday.findFirst({
      where: { date, OR: [{ branchId: null }, { branchId: e.branchId }] },
    }));
    const leave = !!(await tx.leaveRequest.findFirst({
      where: { employeeId, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } },
    }));
    const data = {
      ...calculateAttendance(
        date,
        e.shift,
        punches,
        this.env.COMPANY_TIMEZONE,
        holiday,
        leave &&
          !holiday &&
          !e.shift.weeklyOff.includes(DateTime.fromJSDate(date, { zone: 'utc' }).weekday),
      ),
      source: override ? 'REGULARIZATION' : 'CALCULATED',
      shiftSnapshot: JSON.parse(JSON.stringify(e.shift)) as Prisma.InputJsonValue,
    };
    return tx.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, ...data },
      update: data,
    });
  }
  async punch(u: Principal, d: PunchDto) {
    const employeeId = d.employeeId ?? u.employeeId;
    if (!employeeId) throw new BadRequestException('Employee profile required');
    if (!isHR(u) && (employeeId !== u.employeeId || d.occurredAt))
      throw new ForbiddenException('Only HR may enter historical or other-employee punches');
    return this.db.atomic(async (tx) => {
      const e = await this.scope.employee(u, employeeId, false, tx);
      if (!['ACTIVE', 'NOTICE_PERIOD'].includes(e.status))
        throw new ConflictException('Employee is not active');
      const instant = d.occurredAt ? new Date(d.occurredAt) : new Date();
      if (instant.getTime() > Date.now() + 60000)
        throw new BadRequestException('Punch cannot be in the future');
      const shift = await tx.shift.findUniqueOrThrow({ where: { id: e.shiftId } });
      const date = this.workday(instant, shift.startMinute, shift.endMinute);
      await assertPeriodEditable(tx, date);
      const prior = await tx.rawPunch.findUnique({ where: { externalId: d.externalId } });
      if (prior) {
        if (
          prior.employeeId !== employeeId ||
          prior.direction !== d.direction ||
          (d.occurredAt && prior.occurredAt.getTime() !== instant.getTime())
        )
          throw new ConflictException('External event ID already used');
        return {
          punch: prior,
          attendance: await tx.attendance.findUnique({
            where: { employeeId_date: { employeeId, date } },
          }),
        };
      }
      const p = await tx.rawPunch.create({
        data: {
          employeeId,
          occurredAt: instant,
          direction: d.direction,
          externalId: d.externalId,
          source: d.occurredAt ? 'HR' : 'WEB',
        },
      });
      const attendance = await this.recalculate(tx, employeeId, date);
      await this.audit.write(tx, u.id, 'attendance.punch_recorded', 'RawPunch', p.id, undefined, {
        employeeId,
        direction: d.direction,
      });
      return { punch: p, attendance };
    });
  }
  calculate(u: Principal, d: CalculateDto) {
    return this.db.atomic(async (tx) => {
      await this.scope.employee(u, d.employeeId, false, tx);
      const dates = datesBetween(dateOnly(d.from), dateOnly(d.to), 62);
      if (dates.at(-1)! > localDay(new Date(), this.env.COMPANY_TIMEZONE))
        throw new BadRequestException('Cannot calculate future attendance');
      const items = [];
      for (const date of dates) items.push(await this.recalculate(tx, d.employeeId, date));
      await this.audit.write(
        tx,
        u.id,
        'attendance.calculated',
        'Employee',
        d.employeeId,
        undefined,
        { from: d.from, to: d.to, records: items.length },
      );
      return { items };
    });
  }
  async import(u: Principal, file: Express.Multer.File) {
    if (!file || file.size > 1024 * 1024)
      throw new BadRequestException('CSV file required, maximum 1 MiB');
    let rows: Record<string, string>[];
    try {
      rows = parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: false,
      }) as Record<string, string>[];
    } catch {
      throw new BadRequestException('Invalid CSV');
    }
    if (!rows.length || rows.length > 5000)
      throw new BadRequestException('CSV must contain 1–5000 records');
    for (const [i, r] of rows.entries())
      if (
        Object.keys(r).sort().join(',') !== 'direction,employeeCode,externalId,occurredAt' ||
        !['IN', 'OUT'].includes(r.direction) ||
        !r.externalId ||
        r.externalId.length > 150 ||
        !DateTime.fromISO(r.occurredAt, { setZone: true }).isValid ||
        !/[Zz]|[+-]\d{2}:\d{2}$/.test(r.occurredAt)
      )
        throw new BadRequestException(`Invalid CSV row ${i + 2}`);
    return this.db.atomic(async (tx) => {
      let inserted = 0;
      const days = new Map<string, { id: string; date: Date }>();
      for (const r of rows) {
        const e = await tx.employee.findUnique({
          where: { employeeCode: r.employeeCode },
          include: { shift: true },
        });
        if (!e) throw new BadRequestException(`Unknown employee ${r.employeeCode}`);
        await this.scope.employee(u, e.id, false, tx);
        const at = new Date(r.occurredAt);
        if (at.getTime() > Date.now() + 60000)
          throw new BadRequestException('Future punches are not allowed');
        const date = this.workday(at, e.shift.startMinute, e.shift.endMinute);
        await assertPeriodEditable(tx, date);
        const previous = await tx.rawPunch.findUnique({ where: { externalId: r.externalId } });
        if (previous) {
          if (
            previous.employeeId !== e.id ||
            previous.direction !== r.direction ||
            previous.occurredAt.getTime() !== at.getTime()
          )
            throw new ConflictException('Conflicting duplicate externalId');
        } else {
          await tx.rawPunch.create({
            data: {
              employeeId: e.id,
              occurredAt: at,
              direction: r.direction,
              source: 'CSV_BIOMETRIC',
              externalId: r.externalId,
            },
          });
          inserted++;
        }
        days.set(`${e.id}/${isoDate(date)}`, { id: e.id, date });
      }
      for (const day of days.values()) await this.recalculate(tx, day.id, day.date);
      await this.audit.write(tx, u.id, 'attendance.imported', 'Import', 'csv', undefined, {
        inserted,
        rows: rows.length,
      });
      return { inserted, duplicates: rows.length - inserted, recalculated: days.size };
    });
  }
}
