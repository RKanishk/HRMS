import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ENV, type Environment } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { decrypt } from '../common/crypto.js';
import { EmailService } from './email.service.js';
import type { EmailMessage } from './notifications.service.js';
@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;
  private timer?: NodeJS.Timeout;
  private busy = false;
  private logger = new Logger(EmailWorker.name);
  constructor(
    private db: PrismaService,
    private email: EmailService,
    @Inject(ENV) private env: Environment,
  ) {}
  async onModuleInit() {
    const u = new URL(this.env.REDIS_URL);
    const connection = {
      host: u.hostname,
      port: Number(u.port || 6379),
      password: u.password || undefined,
      username: u.username || undefined,
      db: Number(u.pathname.slice(1) || 0),
      ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
    };
    this.queue = new Queue('cipl-email', {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
    this.worker = new Worker(
      'cipl-email',
      async (job) => {
        const id = job.data.id as string;
        const row = await this.db.emailOutbox.findUnique({ where: { id } });
        if (!row || row.status === 'SENT') return;
        try {
          await this.email.send(
            id,
            JSON.parse(decrypt(row.encryptedPayload, this.env.DATA_ENCRYPTION_KEY)) as EmailMessage,
          );
          await this.db.emailOutbox.update({
            where: { id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              encryptedPayload: '',
              attempts: { increment: 1 },
              lastError: null,
            },
          });
        } catch {
          await this.db.emailOutbox.update({
            where: { id },
            data: {
              attempts: { increment: 1 },
              lastError: 'Email delivery failed',
              status: job.attemptsMade >= 4 ? 'FAILED' : 'PENDING',
            },
          });
          throw new Error('Email delivery failed');
        }
      },
      { connection, concurrency: 2 },
    );
    this.queue.on('error', () => this.logger.error('Email queue unavailable'));
    this.worker.on('error', () => this.logger.error('Email worker unavailable'));
    this.timer = setInterval(() => void this.dispatch(), 2000);
    this.timer.unref();
    await this.dispatch();
  }
  async dispatch() {
    if (this.busy || !this.queue) return;
    this.busy = true;
    try {
      const rows = await this.db.emailOutbox.findMany({
        where: { status: 'PENDING' },
        take: 100,
        orderBy: { createdAt: 'asc' },
      });
      for (const row of rows) await this.queue.add('send', { id: row.id }, { jobId: row.id });
    } catch {
      this.logger.error('Outbox dispatch deferred');
    } finally {
      this.busy = false;
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }
}
