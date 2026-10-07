import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { Permissions } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
@ApiTags('Permissions')
@Controller('permissions')
@Permissions('roles.manage')
export class PermissionsController {
  constructor(private db: PrismaService) {}
  @Get() @Api('Permission catalog', 'PermissionsResult') async list() {
    return { items: await this.db.permission.findMany({ orderBy: { code: 'asc' } }) };
  }
}
