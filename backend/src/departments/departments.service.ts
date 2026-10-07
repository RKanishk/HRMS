import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.types.js';
import { MasterDto, MasterUpdateDto } from '../common/master.dto.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
@Injectable()
export class DepartmentService {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
  ) {}
  async list(q: PageQuery) {
    const where = {
      name: q.search ? { contains: q.search, mode: 'insensitive' as const } : undefined,
    };
    const [items, total] = await this.db.$transaction([
      this.db.department.findMany({ where, ...pageArgs(q), orderBy: { name: q.sortOrder } }),
      this.db.department.count({ where }),
    ]);
    return paged(items, total, q);
  }
  create(u: Principal, d: MasterDto) {
    return this.db.atomic(async (tx) => {
      const row = await tx.department.create({ data: d });
      await this.audit.write(tx, u.id, 'department.created', 'Department', row.id, undefined, row);
      return row;
    });
  }
  update(u: Principal, id: string, d: MasterUpdateDto) {
    return this.db.atomic(async (tx) => {
      const before = await tx.department.findUniqueOrThrow({ where: { id } });
      const after = await tx.department.update({ where: { id }, data: d });
      await this.audit.write(tx, u.id, 'department.updated', 'Department', id, before, after);
      return after;
    });
  }
}
