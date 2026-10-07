import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { PageQuery } from '../common/dto.js';
import { PayrollService } from './payroll.service.js';
import { PayrollInputDto, PeriodDto } from './payroll.dto.js';
@ApiTags('Payroll')
@Controller('payroll')
export class PayrollController {
  constructor(private service: PayrollService) {}
  @Get('runs')
  @Permissions('payroll.view')
  @Api('List monthly payroll runs', 'PayrollRun', 200, true)
  list(@Query() q: PageQuery) {
    return this.service.list(q);
  }
  @Get('runs/:id')
  @Permissions('payroll.view')
  @Api('Payroll run, inputs, employee totals and calculation snapshots', 'PayrollRunDetail')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
  @Post('runs')
  @Permissions('payroll.process')
  @Api('Open one payroll run per calendar month', 'PayrollRun', 201)
  create(@CurrentUser() u: Principal, @Body() d: PeriodDto) {
    return this.service.create(u, d);
  }
  @Put('runs/:id/inputs')
  @Permissions('payroll.process')
  @Api('Save an auditable variable pay input on OPEN payroll', 'PayrollInput')
  input(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PayrollInputDto,
  ) {
    return this.service.input(u, id, d);
  }
  @Post('runs/:id/process')
  @Permissions('payroll.process')
  @Api(
    'Calculate all eligible employees atomically; incomplete attendance blocks processing',
    'PayrollRun',
    201,
  )
  process(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.process(u, id);
  }
  @Post('runs/:id/reopen')
  @Permissions('payroll.process')
  @Api('Reopen REVIEW payroll for correction; preserve prior totals in audit', 'Result', 201)
  reopen(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reopen(u, id);
  }
  @Post('runs/:id/approve')
  @Permissions('payroll.approve')
  @Api('Independent approval of REVIEW payroll', 'PayrollRun', 201)
  approve(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.approve(u, id);
  }
  @Post('runs/:id/lock')
  @Permissions('payroll.approve')
  @Api('Lock APPROVED payroll and publish payslips', 'PayrollRun', 201)
  lock(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.lock(u, id);
  }
}
