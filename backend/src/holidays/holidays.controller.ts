import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RangeQuery, pageArgs, paged } from '../common/dto.js';
import { dateOnly } from '../common/dates.js';
import { assertPeriodEditable } from '../common/business-lock.js';
export class HolidayDto {
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiProperty({ format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Omit for company-wide holiday' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
@ApiTags('Holidays')
@Controller('holidays')
export class HolidaysController {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
  ) {}
  @Get()
  @Permissions('organization.view')
  @Api('Holiday calendar', 'Holiday', 200, true)
  async list(@Query() q: RangeQuery) {
    const where = {
      date: { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined },
    };
    const [items, total] = await this.db.$transaction([
      this.db.holiday.findMany({ where, ...pageArgs(q), orderBy: { date: 'asc' } }),
      this.db.holiday.count({ where }),
    ]);
    return paged(items, total, q);
  }
  @Post()
  @Permissions('organization.manage')
  @Api('Add holiday outside processed payroll', 'Holiday', 201)
  create(@CurrentUser() u: Principal, @Body() d: HolidayDto) {
    return this.db.atomic(async (tx) => {
      const date = dateOnly(d.date);
      await assertPeriodEditable(tx, date);
      const row = await tx.holiday.create({ data: { ...d, date } });
      await this.audit.write(tx, u.id, 'holiday.created', 'Holiday', row.id, undefined, row);
      return row;
    });
  }
  @Delete(':id')
  @Permissions('organization.manage')
  @Api('Remove unprocessed holiday; retain audit')
  remove(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.db.atomic(async (tx) => {
      const row = await tx.holiday.findUniqueOrThrow({ where: { id } });
      await assertPeriodEditable(tx, row.date);
      await tx.holiday.delete({ where: { id } });
      await this.audit.write(tx, u.id, 'holiday.removed', 'Holiday', id, row);
      return { message: 'Holiday removed' };
    });
  }
}
