import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../auth/auth.types.js';
import { ComponentDto, SalaryAssignmentDto, StructureDto } from './salary.dto.js';
import { dateOnly } from '../common/dates.js';
import { PageQuery, pageArgs, paged } from '../common/dto.js';
import { Prisma } from '../generated/prisma/client.js';
@Injectable()
export class SalaryService {
  constructor(
    private db: PrismaService,
    private audit: AuditService,
  ) {}
  async components() {
    return { items: await this.db.salaryComponent.findMany({ orderBy: { code: 'asc' } }) };
  }
  component(u: Principal, d: ComponentDto) {
    if (d.code === 'LOP')
      throw new BadRequestException('LOP is reserved for attendance deductions');
    return this.db.atomic(async (tx) => {
      const row = await tx.salaryComponent.create({ data: d });
      await this.audit.write(
        tx,
        u.id,
        'salary.component_created',
        'SalaryComponent',
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }
  async structures(q: PageQuery) {
    const [items, total] = await this.db.$transaction([
      this.db.salaryStructure.findMany({
        ...pageArgs(q),
        include: { rules: { include: { component: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.salaryStructure.count(),
    ]);
    return paged(items, total, q);
  }
  structure(u: Principal, d: StructureDto) {
    return this.db.atomic(async (tx) => {
      const ids = d.rules.map((r) => r.componentId);
      if (new Set(ids).size !== ids.length)
        throw new BadRequestException('Duplicate salary component');
      const components = await tx.salaryComponent.findMany({
        where: { id: { in: ids }, active: true },
      });
      if (components.length !== ids.length)
        throw new BadRequestException('Unknown/inactive salary component');
      const basic = components.find((c) => c.code === 'BASIC');
      const baseRule = d.rules.find((r) => r.componentId === basic?.id);
      if (
        !basic ||
        basic.kind !== 'EARNING' ||
        baseRule?.method !== 'FIXED' ||
        new Prisma.Decimal(baseRule.value).lte(0)
      )
        throw new BadRequestException('A positive fixed BASIC earning is required');
      for (const rule of d.rules) {
        const c = components.find((c) => c.id === rule.componentId)!;
        if (c.kind === 'EARNING' && rule.method === 'PERCENT_GROSS')
          throw new BadRequestException(
            'Earnings cannot depend on gross; use FIXED or PERCENT_BASIC',
          );
        if (rule.method !== 'FIXED' && new Prisma.Decimal(rule.value).gt(100))
          throw new BadRequestException('Percentage must not exceed 100');
      }
      const row = await tx.salaryStructure.create({
        data: {
          name: d.name,
          version: d.version,
          effectiveFrom: dateOnly(d.effectiveFrom),
          rules: { create: d.rules },
        },
        include: { rules: { include: { component: true } } },
      });
      await this.audit.write(
        tx,
        u.id,
        'salary.structure_version_created',
        'SalaryStructure',
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }
  assign(u: Principal, d: SalaryAssignmentDto) {
    return this.db.atomic(async (tx) => {
      const e = await tx.employee.findUniqueOrThrow({ where: { id: d.employeeId } });
      const structure = await tx.salaryStructure.findUniqueOrThrow({
        where: { id: d.structureId },
      });
      const from = dateOnly(d.effectiveFrom);
      if (from < structure.effectiveFrom || from < e.joiningDate)
        throw new BadRequestException('Assignment precedes salary version or joining date');
      if (from.getUTCDate() !== 1 && from.getTime() !== e.joiningDate.getTime())
        throw new BadRequestException(
          'Salary changes take effect on first of month; initial salary may start on joining',
        );
      if (
        await tx.payrollEmployee.findFirst({
          where: { employeeId: e.id, run: { period: { endDate: { gte: from } } } },
        })
      )
        throw new ConflictException('Assignment would alter processed payroll');
      const row = await tx.employeeSalaryStructure.create({
        data: { employeeId: d.employeeId, structureId: d.structureId, effectiveFrom: from },
      });
      await this.audit.write(
        tx,
        u.id,
        'salary.assigned',
        'EmployeeSalaryStructure',
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }
  async assignments(employeeId: string) {
    return {
      items: await this.db.employeeSalaryStructure.findMany({
        where: { employeeId },
        include: { structure: { include: { rules: { include: { component: true } } } } },
        orderBy: { effectiveFrom: 'desc' },
      }),
    };
  }
}
