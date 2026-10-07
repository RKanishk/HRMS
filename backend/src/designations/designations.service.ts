import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.types.js';
import { MasterDto, MasterUpdateDto } from '../common/master.dto.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
@Injectable()
export class DesignationService {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
  ) {}
  async list(q: PageQuery) {
    const where = {
      name: q.search ? { contains: q.search, mode: 'insensitive' as const } : undefined,
    };
    const [items, total] = await this.db.$transaction([
      this.db.designation.findMany({ where, ...pageArgs(q), orderBy: { name: q.sortOrder } }),
      this.db.designation.count({ where }),
    ]);
    return paged(items, total, q);
  }
  create(u: Principal, d: MasterDto) {
    return this.db.atomic(async (tx) => {
      const row = await tx.designation.create({ data: d });
      await this.audit.write(
        tx,
        u.id,
        'designation.created',
        'Designation',
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }
  update(u: Principal, id: string, d: MasterUpdateDto) {
    return this.db.atomic(async (tx) => {
      const before = await tx.designation.findUniqueOrThrow({ where: { id } });
      const after = await tx.designation.update({ where: { id }, data: d });
      await this.audit.write(tx, u.id, 'designation.updated', 'Designation', id, before, after);
      return after;
    });
  }
}
