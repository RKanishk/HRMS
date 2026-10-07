import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { MasterDto, MasterUpdateDto } from '../common/master.dto.js';
import { PageQuery } from '../common/dto.js';
import { DepartmentService } from './departments.service.js';
@ApiTags('Department')
@Controller('departments')
export class DepartmentController {
  constructor(private service: DepartmentService) {}
  @Get() @Permissions('organization.view') @Api('List departments', 'Master', 200, true) list(
    @Query() q: PageQuery,
  ) {
    return this.service.list(q);
  }
  @Post() @Permissions('organization.manage') @Api('Create department', 'Master', 201) create(
    @CurrentUser() u: Principal,
    @Body() d: MasterDto,
  ) {
    return this.service.create(u, d);
  }
  @Patch(':id')
  @Permissions('organization.manage')
  @Api('Update or deactivate department', 'Master')
  update(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: MasterUpdateDto,
  ) {
    return this.service.update(u, id, d);
  }
}
