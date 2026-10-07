import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { EmployeesService } from './employees.service.js';
import { ProfileService } from './profile.service.js';
import {
  AddressDto,
  BankDto,
  EducationDto,
  EmergencyDto,
  EmployeeCreateDto,
  EmployeeQuery,
  EmployeeStatusDto,
  EmployeeUpdateDto,
  ExperienceDto,
  PersonalDto,
} from './employees.dto.js';
@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(
    private service: EmployeesService,
    private profile: ProfileService,
  ) {}
  @Get()
  @Permissions('employee.view')
  @Api(
    'Search scoped employees; HR all, managers direct reports, employees self',
    'Employee',
    200,
    true,
  )
  list(@CurrentUser() u: Principal, @Query() q: EmployeeQuery) {
    return this.service.list(u, q);
  }
  @Get(':id') @Permissions('employee.view') @Api('Employee business profile', 'Employee') get(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(u, id);
  }
  @Post() @Permissions('employee.create') @Api('Create employee', 'Employee', 201) create(
    @CurrentUser() u: Principal,
    @Body() d: EmployeeCreateDto,
  ) {
    return this.service.create(u, d);
  }
  @Patch(':id')
  @Permissions('employee.update')
  @Api('Update employee business profile', 'Employee')
  update(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EmployeeUpdateDto,
  ) {
    return this.service.update(u, id, d);
  }
  @Patch(':id/status')
  @Permissions('employee.deactivate')
  @Api('Change status; retain history and revoke deactivated accounts', 'Employee')
  status(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EmployeeStatusDto,
  ) {
    return this.service.status(u, id, d);
  }
  @Get(':id/history')
  @Permissions('employee.view')
  @Api('Employee history, self or HR only', 'EmployeeHistory', 200, true)
  history(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: EmployeeQuery,
  ) {
    return this.service.history(u, id, q);
  }
  @Get(':id/personal')
  @Permissions('employee.view')
  @Api('Private profile; self or HR only', 'PrivateProfile')
  private(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.profile.get(u, id);
  }
  @Put(':id/personal')
  @Permissions('employee.profile')
  @Api('Update private profile; self or HR only', 'PersonalDetails')
  personal(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PersonalDto,
  ) {
    return this.profile.personal(u, id, d);
  }
  @Get(':id/bank')
  @Permissions('employee.bank')
  @Api('Masked bank details; self or HR only', 'BankResult')
  bank(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.profile.bank(u, id);
  }
  @Put(':id/bank')
  @Permissions('employee.bank')
  @Api('Encrypt and update bank details; self or HR only', 'BankUpdate')
  setBank(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Body() d: BankDto) {
    return this.profile.setBank(u, id, d);
  }
  @Put(':id/address')
  @Permissions('employee.profile')
  @Api('Upsert address by type', 'Address')
  address(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AddressDto,
  ) {
    return this.profile.address(u, id, d);
  }
  @Post(':id/emergency-contacts')
  @Permissions('employee.profile')
  @Api('Add emergency contact', 'EmergencyContact', 201)
  emergency(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EmergencyDto,
  ) {
    return this.profile.emergency(u, id, d);
  }
  @Post(':id/education')
  @Permissions('employee.profile')
  @Api('Add education', 'Education', 201)
  education(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EducationDto,
  ) {
    return this.profile.education(u, id, d);
  }
  @Post(':id/experience')
  @Permissions('employee.profile')
  @Api('Add employment experience', 'Experience', 201)
  experience(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ExperienceDto,
  ) {
    return this.profile.experience(u, id, d);
  }
}
