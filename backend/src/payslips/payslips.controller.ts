import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
const escape = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
@ApiTags('Payslips')
@Controller('payslips')
@Permissions('payslip.view')
export class PayslipsController {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
  ) {}
  @Get()
  @Api('List published payslips; own only unless payroll.view', 'Payslip', 200, true)
  async list(@CurrentUser() u: Principal, @Query() q: PageQuery) {
    const where = {
      payrollEmployee: {
        employeeId: u.permissions.includes('payroll.view')
          ? undefined
          : (u.employeeId ?? '00000000-0000-0000-0000-000000000000'),
        run: { status: 'LOCKED' as const },
      },
    };
    const [items, total] = await this.db.$transaction([
      this.db.payslip.findMany({
        where,
        ...pageArgs(q),
        include: { payrollEmployee: { include: { run: { include: { period: true } } } } },
        orderBy: { publishedAt: 'desc' },
      }),
      this.db.payslip.count({ where }),
    ]);
    return paged(items, total, q);
  }
  private async load(u: Principal, id: string) {
    return this.db.atomic(async (tx) => {
      const slip = await tx.payslip.findUniqueOrThrow({
        where: { id },
        include: {
          payrollEmployee: { include: { components: true, run: { include: { period: true } } } },
        },
      });
      if (
        slip.payrollEmployee.run.status !== 'LOCKED' ||
        (!u.permissions.includes('payroll.view') &&
          slip.payrollEmployee.employeeId !== u.employeeId)
      )
        throw new ForbiddenException();
      await this.audit.write(tx, u.id, 'payslip.viewed', 'Payslip', id);
      return slip;
    });
  }
  @Get(':id') @Api('Published payslip data and immutable calculation snapshot', 'Payslip') get(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.load(u, id);
  }
  @Get(':id/print')
  @ApiProduces('text/html')
  @Api('Download escaped, printable HTML for browser print-to-PDF', 'PrintDocument')
  async print(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const slip = await this.load(u, id);
    const p = slip.payrollEmployee;
    const snapshot = p.snapshot as Record<string, unknown>;
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>CIPL Payslip</title><style>body{font:15px Arial,sans-serif;max-width:800px;margin:40px auto;color:#171717}h1{border-bottom:3px solid #b81824;padding-bottom:16px}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}.amount{text-align:right}.net{font-size:22px}footer{margin-top:40px;font-size:11px;color:#555}@page{size:A4;margin:20mm}</style></head><body><h1>CIPL HRMS · Payslip</h1><p>${escape(snapshot.name)} · ${escape(snapshot.employeeCode)}</p><p>${escape(snapshot.department)} · ${escape(snapshot.designation)}</p><p>Period: ${p.run.period.year}-${String(p.run.period.month).padStart(2, '0')} · Paid days: ${p.paidDays.toFixed(2)} · LOP days: ${p.lopDays.toFixed(2)}</p><table><thead><tr><th>Component</th><th>Type</th><th class="amount">Amount (INR)</th></tr></thead><tbody>${p.components.map((c) => `<tr><td>${escape(c.name)}</td><td>${escape(c.kind)}</td><td class="amount">${c.amount.toFixed(2)}</td></tr>`).join('')}</tbody></table><p>Gross: INR ${p.gross.toFixed(2)} · Deductions: INR ${p.deductions.toFixed(2)}</p><p class="net">Net pay: INR ${p.net.toFixed(2)}</p><footer>Generated from locked payroll. Payslip ${escape(id)}. Confidential employee document.</footer></body></html>`;
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.attachment(`payslip-${id}.html`).type('html').send(html);
  }
}
