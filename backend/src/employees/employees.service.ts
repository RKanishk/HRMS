import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ScopeService } from '../common/scope.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Principal } from '../auth/auth.types.js';
import {
  EmployeeCreateDto,
  EmployeeQuery,
  EmployeeStatusDto,
  EmployeeUpdateDto,
} from './employees.dto.js';
import { pageArgs, paged } from '../common/dto.js';
import { dateOnly } from '../common/dates.js';
const include = {
  department: true,
  designation: true,
  branch: true,
  shift: true,
  employment: true,
  manager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
};
@Injectable()
export class EmployeesService {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
    private scope: ScopeService,
    private notify: NotificationsService,
  ) {}
  async list(u: Principal, q: EmployeeQuery) {
    const allowed = ['createdAt', 'employeeCode', 'firstName', 'joiningDate', 'status'];
    if (!allowed.includes(q.sortBy))
      throw new BadRequestException(`sortBy must be one of ${allowed.join(', ')}`);
    const where: Prisma.EmployeeWhereInput = {
      AND: [this.scope.filter(u)],
      departmentId: q.departmentId,
      designationId: q.designationId,
      branchId: q.branchId,
      managerId: q.managerId,
      status: q.status,
      ...(q.search
        ? {
            OR: ['employeeCode', 'firstName', 'lastName', 'email'].map((k) => ({
              [k]: { contains: q.search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.employee.findMany({
        where,
        include,
        ...pageArgs(q),
        orderBy: [{ [q.sortBy]: q.sortOrder }, { id: 'asc' }],
      }),
      this.db.employee.count({ where }),
    ]);
    return paged(items, total, q);
  }
  async get(u: Principal, id: string) {
    await this.scope.employee(u, id);
    return this.db.employee.findUniqueOrThrow({ where: { id }, include });
  }
  private async references(tx: Prisma.TransactionClient, d: EmployeeUpdateDto, id?: string) {
    for (const key of ['departmentId', 'designationId', 'branchId', 'shiftId'] as const) {
      const value = d[key];
      if (!value) continue;
      let row: { active: boolean } | null = null;
      if (key === 'departmentId') row = await tx.department.findUnique({ where: { id: value } });
      if (key === 'designationId') row = await tx.designation.findUnique({ where: { id: value } });
      if (key === 'branchId') row = await tx.branch.findUnique({ where: { id: value } });
      if (key === 'shiftId') row = await tx.shift.findUnique({ where: { id: value } });
      if (!row?.active) throw new BadRequestException(`Invalid or inactive ${key}`);
    }
    if (d.managerId) {
      let current: string | null = d.managerId;
      const seen = new Set<string>();
      while (current) {
        if (current === id || seen.has(current))
          throw new BadRequestException('Reporting hierarchy cannot contain cycles');
        seen.add(current);
        const m: { managerId: string | null; status: string } | null = await tx.employee.findUnique(
          { where: { id: current }, select: { managerId: true, status: true } },
        );
        if (!m || !['ACTIVE', 'NOTICE_PERIOD'].includes(m.status))
          throw new BadRequestException('Invalid reporting manager');
        current = m.managerId;
      }
    }
  }
  async create(u: Principal, d: EmployeeCreateDto) {
    return this.db.atomic(async (tx) => {
      await this.references(tx, d);
      const { employmentType, ...data } = d;
      const e = await tx.employee.create({
        data: {
          ...data,
          email: d.email.toLowerCase(),
          joiningDate: dateOnly(d.joiningDate),
          employment: { create: { employmentType: employmentType ?? 'FULL_TIME' } },
        },
        include,
      });
      await tx.employeeHistory.create({
        data: {
          employeeId: e.id,
          actorId: u.id,
          action: 'CREATED',
          metadata: { employeeCode: e.employeeCode },
        },
      });
      await this.audit.write(tx, u.id, 'employee.created', 'Employee', e.id, undefined, e);
      await this.notify.approvers(
        tx,
        e.id,
        'onboarding.employee_created',
        'Employee profile created',
        e.id,
      );
      return e;
    });
  }
  async update(u: Principal, id: string, d: EmployeeUpdateDto) {
    return this.db.atomic(async (tx) => {
      const before = await this.scope.employee(u, id, false, tx);
      await this.references(tx, d, id);
      if (
        (d.joiningDate || d.branchId || d.shiftId) &&
        (await tx.payrollEmployee.count({ where: { employeeId: id } }))
      )
        throw new ConflictException(
          'Attendance/payroll-sensitive assignment changes require a future effective-dated policy; existing history cannot be changed',
        );
      const { employmentType, joiningDate, confirmationDate, ...data } = d;
      const join = joiningDate ? dateOnly(joiningDate) : before.joiningDate;
      if (confirmationDate && dateOnly(confirmationDate) < join)
        throw new BadRequestException('Confirmation cannot precede joining');
      const after = await tx.employee.update({
        where: { id },
        data: {
          ...data,
          email: d.email?.toLowerCase(),
          joiningDate: joiningDate ? dateOnly(joiningDate) : undefined,
          confirmationDate: confirmationDate ? dateOnly(confirmationDate) : undefined,
          employment: employmentType
            ? { upsert: { create: { employmentType }, update: { employmentType } } }
            : undefined,
        },
        include,
      });
      await tx.employeeHistory.create({
        data: {
          employeeId: id,
          actorId: u.id,
          action: 'UPDATED',
          metadata: { fields: Object.keys(d) },
        },
      });
      await this.audit.write(tx, u.id, 'employee.updated', 'Employee', id, before, after);
      return after;
    });
  }
  async status(u: Principal, id: string, d: EmployeeStatusDto) {
    return this.db.atomic(async (tx) => {
      const old = await this.scope.employee(u, id, false, tx);
      if (['RESIGNED', 'TERMINATED'].includes(old.status) && d.status !== old.status)
        throw new ConflictException(
          'Final employment status is immutable; create a new employment record for rehire',
        );
      const last = d.lastWorkingDate ? dateOnly(d.lastWorkingDate) : old.lastWorkingDate;
      const resigned = d.resignationDate ? dateOnly(d.resignationDate) : old.resignationDate;
      if (['RESIGNED', 'TERMINATED'].includes(d.status) && !last)
        throw new BadRequestException('Last working date is required');
      if (d.status === 'NOTICE_PERIOD' && !resigned)
        throw new BadRequestException('Resignation date is required');
      if (last && (last < old.joiningDate || (resigned && last < resigned)))
        throw new BadRequestException('Invalid employment dates');
      if (last) {
        const affected = await tx.payrollEmployee.findFirst({
          where: { employeeId: id, run: { period: { endDate: { gt: last } } } },
        });
        if (affected) throw new ConflictException('Exit date would change processed payroll');
      }
      if (['INACTIVE', 'RESIGNED', 'TERMINATED'].includes(d.status)) {
        const account = await tx.user.findUnique({
          where: { employeeId: id },
          include: { roles: { include: { role: true } } },
        });
        if (account?.roles.some((r) => r.role.name === 'SUPER_ADMIN'))
          throw new ForbiddenException(
            'Remove administrator role through account administration before deactivating employee',
          );
        if (account) {
          await tx.user.update({ where: { id: account.id }, data: { active: false } });
          await tx.session.updateMany({
            where: { userId: account.id },
            data: { revokedAt: new Date() },
          });
        }
      }
      const e = await tx.employee.update({
        where: { id },
        data: { status: d.status, lastWorkingDate: last, resignationDate: resigned },
        include,
      });
      await tx.employeeHistory.create({
        data: {
          employeeId: id,
          actorId: u.id,
          action: 'STATUS_CHANGED',
          metadata: { from: old.status, to: d.status, note: d.note },
        },
      });
      await this.audit.write(
        tx,
        u.id,
        'employee.status_changed',
        'Employee',
        id,
        { status: old.status },
        { status: d.status },
      );
      return e;
    });
  }
  async history(u: Principal, id: string, q: EmployeeQuery) {
    await this.scope.employee(u, id, true);
    const [items, total] = await this.db.$transaction([
      this.db.employeeHistory.findMany({
        where: { employeeId: id },
        ...pageArgs(q),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.employeeHistory.count({ where: { employeeId: id } }),
    ]);
    return paged(items, total, q);
  }
}
