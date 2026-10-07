import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { ComponentKind, RuleMethod } from '../generated/prisma/enums.js';
export interface CalculationRule {
  code: string;
  name: string;
  kind: ComponentKind;
  method: RuleMethod;
  value: string;
  prorate: boolean;
  wageCap?: string | null;
  eligibilityGrossMax?: string | null;
}
export interface PayrollLine {
  code: string;
  name: string;
  kind: ComponentKind;
  amount: Prisma.Decimal;
  ruleSnapshot: Prisma.InputJsonValue;
}
export interface VariableInput {
  code: string;
  kind: ComponentKind;
  amount: string;
  note: string;
}
const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);
const money = (v: Prisma.Decimal) => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export function calculatePayroll(
  rules: CalculationRule[],
  calendarDays: number,
  eligibleDays: number,
  lopDays: string,
  inputs: VariableInput[] = [],
) {
  const lop = D(lopDays),
    eligible = D(eligibleDays),
    period = D(calendarDays);
  if (
    calendarDays <= 0 ||
    eligibleDays < 0 ||
    eligibleDays > calendarDays ||
    lop.lt(0) ||
    lop.gt(eligible)
  )
    throw new BadRequestException('Invalid payroll day counts');
  const paid = eligible.minus(lop);
  const basic = rules.find(
    (r) => r.code === 'BASIC' && r.kind === 'EARNING' && r.method === 'FIXED',
  );
  if (!basic) throw new BadRequestException('Missing fixed BASIC rule');
  const base = D(basic.value);
  const lines: PayrollLine[] = [];
  for (const rule of rules.filter((r) => r.kind === 'EARNING')) {
    if (rule.method === 'PERCENT_GROSS')
      throw new BadRequestException('Circular gross salary rule');
    let amount = rule.method === 'FIXED' ? D(rule.value) : base.mul(rule.value).div(100);
    if (rule.prorate) amount = amount.mul(eligible).div(period);
    lines.push({
      code: rule.code,
      name: rule.name,
      kind: 'EARNING',
      amount: money(amount),
      ruleSnapshot: { ...rule },
    });
  }
  let lopAmount = D(0);
  for (const r of rules.filter((r) => r.kind === 'EARNING' && r.prorate)) {
    const monthly = r.method === 'FIXED' ? D(r.value) : base.mul(r.value).div(100);
    lopAmount = lopAmount.plus(monthly.mul(lop).div(period));
  }
  lopAmount = money(lopAmount);
  for (const input of inputs) {
    if (D(input.amount).lt(0) || input.code === 'LOP' || rules.some((r) => r.code === input.code))
      throw new BadRequestException('Variable input must be positive and use a distinct code');
    lines.push({
      code: input.code,
      name: input.code.replaceAll('_', ' '),
      kind: input.kind,
      amount: money(D(input.amount)),
      ruleSnapshot: { source: 'APPROVED_VARIABLE_INPUT', note: input.note },
    });
  }
  const gross = money(
    lines.filter((l) => l.kind === 'EARNING').reduce((sum, l) => sum.plus(l.amount), D(0)),
  );
  const earnedGross = Prisma.Decimal.max(gross.minus(lopAmount), 0);
  const earnedBasic = base.mul(paid).div(period);
  for (const rule of rules.filter((r) => r.kind !== 'EARNING')) {
    let amount = D(0);
    if (!rule.eligibilityGrossMax || earnedGross.lte(rule.eligibilityGrossMax)) {
      if (rule.method === 'FIXED') {
        amount = D(rule.value);
        if (rule.prorate) amount = amount.mul(paid).div(period);
      } else {
        let wage = rule.method === 'PERCENT_BASIC' ? earnedBasic : earnedGross;
        if (rule.wageCap) wage = Prisma.Decimal.min(wage, rule.wageCap);
        amount = wage.mul(rule.value).div(100);
      }
    }
    lines.push({
      code: rule.code,
      name: rule.name,
      kind: rule.kind,
      amount: money(amount),
      ruleSnapshot: { ...rule },
    });
  }
  if (lopAmount.gt(0))
    lines.push({
      code: 'LOP',
      name: 'Loss of pay',
      kind: 'DEDUCTION',
      amount: lopAmount,
      ruleSnapshot: {
        lopDays: lop.toString(),
        calendarDays,
        method: 'PRORATABLE_MONTHLY_EARNINGS / CALENDAR_DAYS * LOP_DAYS',
      },
    });
  const deductions = money(
    lines.filter((l) => l.kind === 'DEDUCTION').reduce((sum, l) => sum.plus(l.amount), D(0)),
  );
  const employerCost = money(
    lines.filter((l) => l.kind === 'EMPLOYER').reduce((sum, l) => sum.plus(l.amount), D(0)),
  );
  const net = money(gross.minus(deductions));
  if (net.lt(0)) throw new BadRequestException('Deductions exceed gross salary');
  return { gross, deductions, net, employerCost, paidDays: paid, lopDays: lop, lines };
}
