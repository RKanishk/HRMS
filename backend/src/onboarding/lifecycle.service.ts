import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ENV, type Environment } from '../config/env.js';
import type { Principal } from '../auth/auth.types.js';
import { dateOnly, localDay } from '../common/dates.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
import { OnboardingDto, OffboardingDto } from './lifecycle.dto.js';
const ONBOARD = [
  'Employee information',
  'Documents',
  'Bank information',
  'Department and designation',
  'Manager and shift',
  'Account activation',
];
const OFFBOARD = [
  'Asset return',
  'Document handover',
  'Knowledge handover',
  'Payroll review',
  'Access removal',
];
@Injectable()
export class LifecycleService {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
    private notify: NotificationsService,
    @Inject(ENV) private env: Environment,
  ) {}
  async list(kind: string, q: PageQuery) {
    const [items, total] = await this.db.$transaction([
      this.db.lifecycleCase.findMany({
        where: { kind },
        include: { tasks: true },
        ...pageArgs(q),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.lifecycleCase.count({ where: { kind } }),
    ]);
    return paged(items, total, q);
  }
  create(u: Principal, kind: 'ONBOARDING' | 'OFFBOARDING', d: OnboardingDto | OffboardingDto) {
    return this.db.atomic(async (tx) => {
      const e = await tx.employee.findUniqueOrThrow({ where: { id: d.employeeId } });
      if (['RESIGNED', 'TERMINATED'].includes(e.status))
        throw new ConflictException('Employee has already exited');
      let dates: { resignationDate?: Date; lastWorkingDate?: Date } = {};
      if (kind === 'OFFBOARDING') {
        const f = d as OffboardingDto;
        dates = {
          resignationDate: dateOnly(f.resignationDate),
          lastWorkingDate: dateOnly(f.lastWorkingDate),
        };
        if (
          dates.resignationDate! < e.joiningDate ||
          dates.lastWorkingDate! < dates.resignationDate!
        )
          throw new BadRequestException('Invalid offboarding dates');
        if (
          await tx.payrollEmployee.count({
            where: {
              employeeId: e.id,
              run: { period: { endDate: { gt: dates.lastWorkingDate } } },
            },
          })
        )
          throw new ConflictException('Offboarding would alter processed payroll');
        await tx.employee.update({
          where: { id: e.id },
          data: { ...dates, status: 'NOTICE_PERIOD' },
        });
        await tx.employeeHistory.create({
          data: {
            employeeId: e.id,
            actorId: u.id,
            action: 'NOTICE_PERIOD',
            metadata: { lastWorkingDate: f.lastWorkingDate },
          },
        });
      }
      const row = await tx.lifecycleCase.create({
        data: {
          employeeId: e.id,
          kind,
          ...dates,
          tasks: {
            create: [...(kind === 'ONBOARDING' ? ONBOARD : OFFBOARD), ...(d.extraTasks ?? [])].map(
              (label) => ({ label }),
            ),
          },
        },
        include: { tasks: true },
      });
      await this.audit.write(
        tx,
        u.id,
        `${kind.toLowerCase()}.opened`,
        'LifecycleCase',
        row.id,
        undefined,
        { employeeId: e.id, ...dates },
      );
      await this.notify.employee(
        tx,
        e.id,
        `${kind.toLowerCase()}.opened`,
        `${kind === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} checklist opened`,
        row.id,
      );
      return row;
    });
  }
  task(u: Principal, kind: string, id: string, taskId: string, completed: boolean) {
    return this.db.atomic(async (tx) => {
      const c = await tx.lifecycleCase.findUniqueOrThrow({ where: { id } });
      if (c.kind !== kind) throw new BadRequestException('Wrong checklist type');
      if (c.status !== 'OPEN') throw new ConflictException('Checklist is closed');
      const t = await tx.checklistTask.findUniqueOrThrow({ where: { id: taskId } });
      if (t.caseId !== id) throw new BadRequestException('Task does not belong to checklist');
      const row = await tx.checklistTask.update({
        where: { id: taskId },
        data: {
          completed,
          completedBy: completed ? u.id : null,
          completedAt: completed ? new Date() : null,
        },
      });
      await this.audit.write(
        tx,
        u.id,
        'lifecycle.task_updated',
        'ChecklistTask',
        taskId,
        { completed: t.completed },
        { completed },
      );
      return row;
    });
  }
  complete(u: Principal, kind: string, id: string) {
    return this.db.atomic(async (tx) => {
      const c = await tx.lifecycleCase.findUniqueOrThrow({
        where: { id },
        include: { tasks: true },
      });
      if (c.kind !== kind) throw new BadRequestException('Wrong checklist type');
      if (c.status !== 'OPEN' || c.tasks.some((t) => t.required && !t.completed))
        throw new ConflictException('Complete required tasks before closing the checklist');
      const e = await tx.employee.findUniqueOrThrow({
        where: { id: c.employeeId },
        include: {
          bank: true,
          documents: { where: { deletedAt: null } },
          user: { include: { roles: { include: { role: true } } } },
        },
      });
      if (kind === 'OFFBOARDING') {
        if (
          !c.lastWorkingDate ||
          c.lastWorkingDate > localDay(new Date(), this.env.COMPANY_TIMEZONE)
        )
          throw new ConflictException('Last working date has not arrived');
        if (e.user?.roles.some((r) => r.role.name === 'SUPER_ADMIN'))
          throw new ForbiddenException('Remove administrator role before offboarding');
        if (e.user) {
          await tx.user.update({ where: { id: e.user.id }, data: { active: false } });
          await tx.session.updateMany({
            where: { userId: e.user.id },
            data: { revokedAt: new Date() },
          });
        }
        await tx.employee.update({ where: { id: e.id }, data: { status: 'RESIGNED' } });
      } else {
        if (!e.bank || !e.documents.length || !e.user?.active)
          throw new ConflictException(
            'Bank information, documents and an active account are required',
          );
      }
      const row = await tx.lifecycleCase.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: { tasks: true },
      });
      await tx.employeeHistory.create({
        data: {
          employeeId: e.id,
          actorId: u.id,
          action: `${kind}_COMPLETED`,
          metadata: { caseId: id },
        },
      });
      await this.audit.write(
        tx,
        u.id,
        `${kind.toLowerCase()}.completed`,
        'LifecycleCase',
        id,
        undefined,
        { employeeId: e.id },
      );
      await this.notify.employee(
        tx,
        e.id,
        `${kind.toLowerCase()}.completed`,
        `${kind === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} completed`,
        id,
      );
      return row;
    });
  }
}
