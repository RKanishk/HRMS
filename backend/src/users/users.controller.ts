import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { PageQuery } from '../common/dto.js';
import { ActiveDto, CreateUserDto, RolesDto } from './users.dto.js';
import { UsersService } from './users.service.js';
@ApiTags('Users')
@Controller('users')
@Permissions('users.manage')
export class UsersController {
  constructor(private service: UsersService) {}
  @Get() @Api('List accounts without authentication secrets', 'User', 200, true) list(
    @Query() q: PageQuery,
  ) {
    return this.service.list(q);
  }
  @Post() @Api('Create an account and initial roles', 'User', 201) create(
    @CurrentUser() u: Principal,
    @Body() d: CreateUserDto,
  ) {
    return this.service.create(u, d);
  }
  @Patch(':id/active') @Api('Activate/deactivate an account', 'User') active(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ActiveDto,
  ) {
    return this.service.active(u, id, d.active);
  }
  @Patch(':id/roles') @Api('Replace account roles and revoke existing sessions', 'User') roles(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RolesDto,
  ) {
    return this.service.roles(u, id, d.roles);
  }
}
