import { Controller, Get, Query } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Api } from '../common/api.js';
import { Permissions } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RangeQuery, pageArgs, paged } from '../common/dto.js';
import { dateOnly } from '../common/dates.js';
export class AuditQuery extends RangeQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) entityId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() actorId?: string;
}
@ApiTags('Audit')
@Controller('audit')
@Permissions('audit.view')
export class AuditController {
  constructor(private db: PrismaService) {}
  @Get()
  @Api('Search append-only audit events; privileged HR/admin only', 'AuditLog', 200, true)
  async list(@Query() q: AuditQuery) {
    const where = {
      entityType: q.entityType,
      entityId: q.entityId,
      actorId: q.actorId,
      createdAt: {
        gte: q.from ? dateOnly(q.from) : undefined,
        lt: q.to ? new Date(dateOnly(q.to).getTime() + 86400000) : undefined,
      },
    };
    const [items, total] = await this.db.$transaction([
      this.db.auditLog.findMany({ where, ...pageArgs(q), orderBy: { createdAt: 'desc' } }),
      this.db.auditLog.count({ where }),
    ]);
    return paged(items, total, q);
  }
}
