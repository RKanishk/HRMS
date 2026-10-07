import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
function clean(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value ?? {}, (k, v) =>
      /password|token|secret|ciphertext|accountNumber|reason|medical/i.test(k) ? '[REDACTED]' : v,
    ),
  ) as Prisma.InputJsonValue;
}
@Injectable()
export class AuditService {
  write(
    tx: Prisma.TransactionClient,
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    before?: unknown,
    after?: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        before: before === undefined ? undefined : clean(before),
        after: after === undefined ? undefined : clean(after),
      },
    });
  }
}
