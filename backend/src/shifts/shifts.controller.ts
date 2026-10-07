import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
import { ShiftDto, ShiftUpdateDto } from './shifts.dto.js';
@ApiTags('Shifts')
@Controller('shifts')
export class ShiftsController {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
  ) {}
  @Get()
  @Permissions('organization.view')
  @Api('List shift definitions', 'Shift', 200, true)
  async list(@Query() q: PageQuery) {
    const [items, total] = await this.db.$transaction([
      this.db.shift.findMany({ ...pageArgs(q), orderBy: { name: 'asc' } }),
      this.db.shift.count(),
    ]);
    return paged(items, total, q);
  }
  @Post() @Permissions('organization.manage') @Api('Create shift definition', 'Shift', 201) create(
    @CurrentUser() u: Principal,
    @Body() d: ShiftDto,
  ) {
    if ((d.halfDayMinutes ?? 240) > (d.fullDayMinutes ?? 480))
      throw new BadRequestException('Half-day threshold exceeds full-day threshold');
    return this.db.atomic(async (tx) => {
      const row = await tx.shift.create({ data: d });
      await this.audit.write(tx, u.id, 'shift.created', 'Shift', row.id, undefined, row);
      return row;
    });
  }
  @Patch(':id')
  @Permissions('organization.manage')
  @Api('Update unused shift or deactivate; historical shifts require a new version', 'Shift')
  update(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ShiftUpdateDto,
  ) {
    return this.db.atomic(async (tx) => {
      const old = await tx.shift.findUniqueOrThrow({ where: { id } });
      if (
        Object.keys(d).some((k) => !['name', 'active'].includes(k)) &&
        (await tx.attendance.count({ where: { employee: { shiftId: id } } }))
      )
        throw new ConflictException('Create a new shift to preserve attendance history');
      if ((d.halfDayMinutes ?? old.halfDayMinutes) > (d.fullDayMinutes ?? old.fullDayMinutes))
        throw new BadRequestException('Invalid thresholds');
      const row = await tx.shift.update({ where: { id }, data: d });
      await this.audit.write(tx, u.id, 'shift.updated', 'Shift', id, old, row);
      return row;
    });
  }
}
