import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private db: PrismaService) {}
  @Get() @Api('List own in-app notifications', 'Notification', 200, true) async list(
    @CurrentUser() u: Principal,
    @Query() q: PageQuery,
  ) {
    const where = { userId: u.id };
    const [items, total] = await this.db.$transaction([
      this.db.notification.findMany({ where, ...pageArgs(q), orderBy: { createdAt: 'desc' } }),
      this.db.notification.count({ where }),
    ]);
    return paged(items, total, q);
  }
  @Patch(':id/read') @Api('Mark own notification as read') async read(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.db.notification.updateMany({
      where: { id, userId: u.id },
      data: { readAt: new Date() },
    });
    return { message: 'Notification marked as read' };
  }
}
