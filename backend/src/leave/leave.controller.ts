import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { RangeQuery, ReviewDto } from '../common/dto.js';
import { LeaveService } from './leave.service.js';
import {
  AllocateLeaveDto,
  LeavePolicyDto,
  LeaveRequestDto,
  LeaveTypeDto,
  LeaveTypeUpdateDto,
} from './leave.dto.js';
@ApiTags('Leave')
@Controller('leave')
export class LeaveController {
  constructor(private service: LeaveService) {}
  @Get('types')
  @Permissions('leave.view')
  @Api('Configurable leave types and annual policies', 'LeaveTypesResult')
  types() {
    return this.service.types();
  }
  @Post('types')
  @Permissions('leave.manage')
  @Api('Create leave type', 'LeaveType', 201)
  typeCreate(@CurrentUser() u: Principal, @Body() d: LeaveTypeDto) {
    return this.service.typeCreate(u, d);
  }
  @Patch('types/:id')
  @Permissions('leave.manage')
  @Api('Update or deactivate leave type', 'LeaveType')
  typeUpdate(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: LeaveTypeUpdateDto,
  ) {
    return this.service.typeUpdate(u, id, d);
  }
  @Post('policies')
  @Permissions('leave.manage')
  @Api('Create immutable annual leave policy', 'LeavePolicy', 201)
  policy(@CurrentUser() u: Principal, @Body() d: LeavePolicyDto) {
    return this.service.policy(u, d);
  }
  @Post('allocate')
  @Permissions('leave.manage')
  @Api('Idempotently allocate annual balances and carry-forward', 'AllocationResult', 201)
  allocate(@CurrentUser() u: Principal, @Body() d: AllocateLeaveDto) {
    return this.service.allocate(u, d);
  }
  @Get('balances')
  @Permissions('leave.view')
  @Api('Scoped leave balances with used, reserved and available days', 'LeaveBalance', 200, true)
  balances(@CurrentUser() u: Principal, @Query() q: RangeQuery) {
    return this.service.balances(u, q);
  }
  @Get('requests')
  @Permissions('leave.view')
  @Api('List scoped leave requests', 'LeaveRequest', 200, true)
  list(@CurrentUser() u: Principal, @Query() q: RangeQuery) {
    return this.service.list(u, q);
  }
  @Post('requests')
  @Permissions('leave.request')
  @Api('Request own leave and reserve paid balance atomically', 'LeaveRequest', 201)
  request(@CurrentUser() u: Principal, @Body() d: LeaveRequestDto) {
    return this.service.request(u, d);
  }
  @Post('requests/:id/review')
  @Permissions('leave.approve')
  @Api('Approve/reject leave and update balance and attendance atomically', 'LeaveRequest', 201)
  review(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReviewDto,
  ) {
    return this.service.review(u, id, d);
  }
  @Post('requests/:id/cancel')
  @Permissions('leave.request')
  @Api('Cancel own leave or HR-managed leave and release balance', 'LeaveRequest', 201)
  cancel(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(u, id);
  }
}
