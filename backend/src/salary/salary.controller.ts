import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { PageQuery } from '../common/dto.js';
import { SalaryService } from './salary.service.js';
import { ComponentDto, SalaryAssignmentDto, StructureDto } from './salary.dto.js';
@ApiTags('Salary')
@Controller('salary')
export class SalaryController {
  constructor(private service: SalaryService) {}
  @Get('components')
  @Permissions('payroll.view')
  @Api('Salary component catalog', 'SalaryComponentsResult')
  components() {
    return this.service.components();
  }
  @Post('components')
  @Permissions('salary.manage')
  @Api('Create salary component', 'SalaryComponent', 201)
  component(@CurrentUser() u: Principal, @Body() d: ComponentDto) {
    return this.service.component(u, d);
  }
  @Get('structures')
  @Permissions('payroll.view')
  @Api('List immutable salary structure versions', 'SalaryStructure', 200, true)
  structures(@Query() q: PageQuery) {
    return this.service.structures(q);
  }
  @Post('structures')
  @Permissions('salary.manage')
  @Api('Create salary structure version; decimal rules only', 'SalaryStructure', 201)
  structure(@CurrentUser() u: Principal, @Body() d: StructureDto) {
    return this.service.structure(u, d);
  }
  @Post('assignments')
  @Permissions('salary.manage')
  @Api('Assign salary version with effective date', 'SalaryAssignment', 201)
  assign(@CurrentUser() u: Principal, @Body() d: SalaryAssignmentDto) {
    return this.service.assign(u, d);
  }
  @Get('assignments/:employeeId')
  @Permissions('payroll.view')
  @Api('Employee salary assignment history', 'SalaryAssignmentsResult')
  assignments(@Param('employeeId', ParseUUIDPipe) id: string) {
    return this.service.assignments(id);
  }
}
