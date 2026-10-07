import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';
import { Api } from '../common/api.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
export class PermissionCodesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions!: string[];
}
@ApiTags('Roles')
@Controller('roles')
@Permissions('roles.manage')
export class RolesController {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
  ) {}
  @Get() @Api('List fixed roles and their permission codes', 'RolesResult') async list() {
    return {
      items: await this.db.role.findMany({
        include: { permissions: { include: { permission: true } } },
        orderBy: { name: 'asc' },
      }),
    };
  }
  @Put(':id/permissions') @Api('Replace a role permission set', 'Role') update(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PermissionCodesDto,
  ) {
    return this.db.atomic(async (tx) => {
      const role = await tx.role.findUniqueOrThrow({
        where: { id },
        include: { permissions: { include: { permission: true } } },
      });
      if (role.name === 'SUPER_ADMIN')
        throw new ConflictException('Super administrator permissions are fixed');
      if (d.permissions.some((p) => ['roles.manage', 'users.manage'].includes(p)))
        throw new BadRequestException('Account and role administration is reserved to SUPER_ADMIN');
      const perms = await tx.permission.findMany({ where: { code: { in: d.permissions } } });
      if (perms.length !== d.permissions.length)
        throw new BadRequestException('Unknown permission');
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: id, permissionId: p.id })),
      });
      await this.audit.write(
        tx,
        u.id,
        'role.permissions_changed',
        'Role',
        id,
        { permissions: role.permissions.map((p) => p.permission.code) },
        { permissions: d.permissions },
      );
      return tx.role.findUniqueOrThrow({
        where: { id },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }
}
