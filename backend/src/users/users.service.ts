import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.types.js';
import { CreateUserDto } from './users.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
const selection = {
  id: true,
  email: true,
  active: true,
  employeeId: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true } } } },
} satisfies Prisma.UserSelect;
@Injectable()
export class UsersService {
  constructor(
    private db: PrismaService,
    private auth: AuthService,
    private audit: AuditService,
  ) {}
  async list(q: PageQuery) {
    const where = {
      email: q.search ? { contains: q.search, mode: 'insensitive' as const } : undefined,
    };
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        select: selection,
        ...pageArgs(q),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.count({ where }),
    ]);
    return paged(items, total, q);
  }
  async create(u: Principal, d: CreateUserDto) {
    const passwordHash = await this.auth.passwordHash(d.password);
    return this.db.atomic(async (tx) => {
      const roles = await tx.role.findMany({ where: { name: { in: d.roles } } });
      if (roles.length !== d.roles.length) throw new BadRequestException('Unknown role');
      if (d.roles.some((r) => ['MANAGER', 'EMPLOYEE'].includes(r)) && !d.employeeId)
        throw new BadRequestException('Employee and manager accounts require an employee profile');
      if (d.employeeId) {
        const e = await tx.employee.findUniqueOrThrow({ where: { id: d.employeeId } });
        if (!['ACTIVE', 'NOTICE_PERIOD'].includes(e.status))
          throw new ConflictException('Employee is not active');
      }
      const user = await tx.user.create({
        data: {
          email: d.email.toLowerCase(),
          passwordHash,
          employeeId: d.employeeId,
          roles: { create: roles.map((r) => ({ roleId: r.id })) },
        },
        select: selection,
      });
      await this.audit.write(tx, u.id, 'user.created', 'User', user.id, undefined, {
        email: user.email,
        roles: d.roles,
      });
      return user;
    });
  }
  private async protectLast(tx: Prisma.TransactionClient, id: string) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (user.active && user.roles.some((r) => r.role.name === 'SUPER_ADMIN')) {
      const count = await tx.user.count({
        where: { active: true, roles: { some: { role: { name: 'SUPER_ADMIN' } } } },
      });
      if (count <= 1)
        throw new ConflictException('Cannot remove the final active super administrator');
    }
  }
  async active(u: Principal, id: string, active: boolean) {
    return this.db.atomic(async (tx) => {
      if (!active) await this.protectLast(tx, id);
      const old = await tx.user.findUniqueOrThrow({ where: { id } });
      if (active && old.employeeId) {
        const e = await tx.employee.findUniqueOrThrow({ where: { id: old.employeeId } });
        if (!['ACTIVE', 'NOTICE_PERIOD'].includes(e.status))
          throw new ConflictException('Employee is not active');
      }
      const result = await tx.user.update({ where: { id }, data: { active }, select: selection });
      if (!active)
        await tx.session.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
      await this.audit.write(
        tx,
        u.id,
        'user.activation_changed',
        'User',
        id,
        { active: old.active },
        { active },
      );
      return result;
    });
  }
  async roles(u: Principal, id: string, names: string[]) {
    return this.db.atomic(async (tx) => {
      if (!names.includes('SUPER_ADMIN')) await this.protectLast(tx, id);
      const old = await tx.user.findUniqueOrThrow({
        where: { id },
        include: { roles: { include: { role: true } } },
      });
      if (names.some((n) => ['MANAGER', 'EMPLOYEE'].includes(n)) && !old.employeeId)
        throw new BadRequestException('These roles require an employee profile');
      const roles = await tx.role.findMany({ where: { name: { in: names } } });
      if (roles.length !== names.length) throw new BadRequestException('Unknown role');
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) });
      await tx.session.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
      await this.audit.write(
        tx,
        u.id,
        'user.roles_changed',
        'User',
        id,
        { roles: old.roles.map((r) => r.role.name) },
        { roles: names },
      );
      return tx.user.findUniqueOrThrow({ where: { id }, select: selection });
    });
  }
}
