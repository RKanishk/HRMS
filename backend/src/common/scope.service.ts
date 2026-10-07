import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Principal } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
export const isHR = (u: Principal) =>
  u.roles.some((r) => ['SUPER_ADMIN', 'HR_ADMIN', 'HR_EXECUTIVE'].includes(r));
@Injectable()
export class ScopeService {
  constructor(private db: PrismaService) {}
  filter(u: Principal): Prisma.EmployeeWhereInput {
    if (isHR(u)) return {};
    if (u.roles.includes('MANAGER') && u.employeeId)
      return { OR: [{ id: u.employeeId }, { managerId: u.employeeId }] };
    return { id: u.employeeId ?? '00000000-0000-0000-0000-000000000000' };
  }
  async employee(
    u: Principal,
    id: string,
    privateData = false,
    tx: Prisma.TransactionClient = this.db,
  ) {
    const e = await tx.employee.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Employee not found');
    if (
      !isHR(u) &&
      e.id !== u.employeeId &&
      (privateData || !u.roles.includes('MANAGER') || e.managerId !== u.employeeId)
    )
      throw new ForbiddenException('Employee is outside your access scope');
    return e;
  }
  async approve(u: Principal, id: string, tx: Prisma.TransactionClient = this.db) {
    if (u.employeeId === id) throw new ForbiddenException('Self approval is prohibited');
    await this.employee(u, id, false, tx);
  }
}
