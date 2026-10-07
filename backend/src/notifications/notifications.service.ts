import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ENV, type Environment } from '../config/env.js';
import { encrypt } from '../common/crypto.js';
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
@Injectable()
export class NotificationsService {
  constructor(@Inject(ENV) private env: Environment) {}
  email(tx: Prisma.TransactionClient, message: EmailMessage) {
    return tx.emailOutbox.create({
      data: { encryptedPayload: encrypt(JSON.stringify(message), this.env.DATA_ENCRYPTION_KEY) },
    });
  }
  async notify(
    tx: Prisma.TransactionClient,
    userId: string,
    event: string,
    title: string,
    entityId?: string,
  ) {
    await tx.notification.create({ data: { userId, event, title, entityId } });
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true, active: true },
    });
    if (user?.active)
      await this.email(tx, {
        to: user.email,
        subject: title,
        text: `${title}. Sign in to CIPL HRMS to view details.`,
      });
  }
  async employee(
    tx: Prisma.TransactionClient,
    employeeId: string,
    event: string,
    title: string,
    entityId?: string,
  ) {
    const u = await tx.user.findUnique({ where: { employeeId }, select: { id: true } });
    if (u) await this.notify(tx, u.id, event, title, entityId);
  }
  async approvers(
    tx: Prisma.TransactionClient,
    employeeId: string,
    event: string,
    title: string,
    entityId: string,
  ) {
    const e = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const users = await tx.user.findMany({
      where: {
        active: true,
        OR: [
          ...(e.managerId ? [{ employeeId: e.managerId }] : []),
          { roles: { some: { role: { name: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } } } } },
        ],
      },
      select: { id: true },
    });
    for (const u of users) await this.notify(tx, u.id, event, title, entityId);
  }
}
