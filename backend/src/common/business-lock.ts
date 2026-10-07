import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
export async function assertPeriodEditable(
  tx: Prisma.TransactionClient,
  date: Date,
  end: Date = date,
) {
  const run = await tx.payrollRun.findFirst({
    where: { status: { not: 'OPEN' }, period: { startDate: { lte: end }, endDate: { gte: date } } },
  });
  if (run)
    throw new ConflictException(
      'Payroll for this date has been processed; use a future-period adjustment',
    );
}
