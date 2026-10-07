import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeService } from '../common/scope.service.js';
import type { Principal } from '../auth/auth.types.js';
import { RangeQuery } from '../common/dto.js';
import { dateOnly } from '../common/dates.js';
import { AuditService } from '../audit/audit.service.js';
export function csvCell(v: unknown) {
  let value = String(v ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(value)) value = `'${value}`;
  return `"${value.replaceAll('"', '""')}"`;
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return (
    '\uFEFF' +
    [
      headers.map(csvCell).join(','),
      ...rows.map((r) => headers.map((k) => csvCell(r[k])).join(',')),
    ].join('\r\n') +
    '\r\n'
  );
}
@Injectable()
export class ReportsService {
  constructor(
    private db: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
  ) {}
  async headcount(u: Principal) {
    const where = this.scope.filter(u);
    const [total, department, branch, status] = await this.db.$transaction([
      this.db.employee.count({ where }),
      this.db.employee.groupBy({ by: ['departmentId'], where, _count: { _all: true } }),
      this.db.employee.groupBy({ by: ['branchId'], where, _count: { _all: true } }),
      this.db.employee.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);
    const departments = await this.db.department.findMany({ select: { id: true, name: true } });
    const branches = await this.db.branch.findMany({ select: { id: true, name: true } });
    return {
      total,
      department: department.map((d) => ({
        id: d.departmentId,
        name: departments.find((n) => n.id === d.departmentId)!.name,
        count: d._count._all,
      })),
      branch: branch.map((d) => ({
        id: d.branchId,
        name: branches.find((n) => n.id === d.branchId)!.name,
        count: d._count._all,
      })),
      status: status.map((s) => ({ status: s.status, count: s._count._all })),
    };
  }
  async attendance(u: Principal, q: RangeQuery) {
    const rows = await this.db.attendance.groupBy({
      by: ['status'],
      where: {
        employee: this.scope.filter(u),
        employeeId: q.employeeId,
        date: {
          gte: q.from ? dateOnly(q.from) : undefined,
          lte: q.to ? dateOnly(q.to) : undefined,
        },
      },
      _count: { _all: true },
      _sum: { workingMinutes: true, lateMinutes: true, earlyMinutes: true, overtimeMinutes: true },
    });
    return { items: rows.map((r) => ({ status: r.status, count: r._count._all, ...r._sum })) };
  }
  async leave(u: Principal, q: RangeQuery) {
    const rows = await this.db.leaveRequest.groupBy({
      by: ['status', 'leaveTypeId'],
      where: {
        employee: this.scope.filter(u),
        employeeId: q.employeeId,
        startDate: { lte: q.to ? dateOnly(q.to) : undefined },
        endDate: { gte: q.from ? dateOnly(q.from) : undefined },
      },
      _count: { _all: true },
      _sum: { days: true },
    });
    const types = await this.db.leaveType.findMany();
    return {
      items: rows.map((r) => ({
        status: r.status,
        leaveType: types.find((t) => t.id === r.leaveTypeId)!.name,
        count: r._count._all,
        days: r._sum.days?.toString() ?? '0',
      })),
    };
  }
  async payroll(u: Principal, q: RangeQuery) {
    if (!u.permissions.includes('payroll.view'))
      throw new ForbiddenException('Payroll permission required');
    const rows = await this.db.payrollEmployee.groupBy({
      by: ['runId'],
      where: {
        employeeId: q.employeeId,
        run: {
          period: {
            startDate: { lte: q.to ? dateOnly(q.to) : undefined },
            endDate: { gte: q.from ? dateOnly(q.from) : undefined },
          },
        },
      },
      _count: { _all: true },
      _sum: { gross: true, deductions: true, net: true, employerCost: true },
    });
    const runs = await this.db.payrollRun.findMany({
      where: { id: { in: rows.map((r) => r.runId) } },
      include: { period: true },
    });
    return {
      items: rows.map((r) => {
        const run = runs.find((x) => x.id === r.runId)!;
        return {
          runId: r.runId,
          year: run.period.year,
          month: run.period.month,
          status: run.status,
          employees: r._count._all,
          gross: r._sum.gross?.toFixed(2) ?? '0.00',
          deductions: r._sum.deductions?.toFixed(2) ?? '0.00',
          net: r._sum.net?.toFixed(2) ?? '0.00',
          employerCost: r._sum.employerCost?.toFixed(2) ?? '0.00',
        };
      }),
    };
  }
  async export(u: Principal, kind: string, q: RangeQuery) {
    let rows: Record<string, unknown>[];
    if (kind === 'headcount') {
      const data = await this.headcount(u);
      rows = data.department.map((r) => ({ department: r.name, count: r.count }));
    } else if (kind === 'attendance') rows = (await this.attendance(u, q)).items;
    else if (kind === 'leave') rows = (await this.leave(u, q)).items;
    else rows = (await this.payroll(u, q)).items;
    await this.db.atomic((tx) =>
      this.audit.write(tx, u.id, 'report.exported', 'Report', kind, undefined, {
        rows: rows.length,
        from: q.from,
        to: q.to,
      }),
    );
    return toCsv(rows);
  }
}
