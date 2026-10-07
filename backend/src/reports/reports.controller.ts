import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { RangeQuery } from '../common/dto.js';
import { ReportsService } from './reports.service.js';
@ApiTags('Reports')
@Controller('reports')
@Permissions('reports.view')
export class ReportsController {
  constructor(private service: ReportsService) {}
  @Get('headcount')
  @Api('Current headcount by department, branch and employee status', 'HeadcountReport')
  headcount(@CurrentUser() u: Principal) {
    return this.service.headcount(u);
  }
  @Get('attendance')
  @Api('Attendance totals by status within date range', 'AttendanceReport')
  attendance(@CurrentUser() u: Principal, @Query() q: RangeQuery) {
    return this.service.attendance(u, q);
  }
  @Get('leave')
  @Api('Leave requests intersecting date range; totals use whole request days', 'LeaveReport')
  leave(@CurrentUser() u: Principal, @Query() q: RangeQuery) {
    return this.service.leave(u, q);
  }
  @Get('payroll')
  @Permissions('reports.view', 'payroll.view')
  @Api('Payroll totals for periods intersecting date range', 'PayrollReport')
  payroll(@CurrentUser() u: Principal, @Query() q: RangeQuery) {
    return this.service.payroll(u, q);
  }
  @Get(':kind/export')
  @Permissions('reports.view', 'reports.export')
  @ApiParam({ name: 'kind', enum: ['headcount', 'attendance', 'leave', 'payroll'] })
  @ApiProduces('text/csv')
  @Api('Export scoped report as spreadsheet-safe CSV', 'CsvDocument')
  async export(
    @CurrentUser() u: Principal,
    @Param('kind') kind: string,
    @Query() q: RangeQuery,
    @Res() res: Response,
  ) {
    if (!['headcount', 'attendance', 'leave', 'payroll'].includes(kind))
      throw new BadRequestException('Unknown report kind');
    const data = await this.service.export(u, kind, q);
    res.attachment(`${kind}.csv`).type('text/csv').send(data);
  }
}
