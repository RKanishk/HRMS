import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ENV, type Environment } from '../config/env.js';
import type { EmailMessage } from './notifications.service.js';
export abstract class EmailAdapter {
  abstract send(id: string, message: EmailMessage): Promise<void>;
}
@Injectable()
export class EmailService extends EmailAdapter implements OnModuleDestroy {
  private smtp: ReturnType<typeof nodemailer.createTransport> | undefined;
  constructor(@Inject(ENV) private env: Environment) {
    super();
    if (env.EMAIL_DRIVER === 'smtp')
      this.smtp = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        requireTLS: env.SMTP_PORT !== 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      });
  }
  async send(id: string, message: EmailMessage) {
    const mail = { from: this.env.EMAIL_FROM, ...message, messageId: `<${id}@cipl-hrms>` };
    if (this.smtp) {
      await this.smtp.sendMail(mail);
      return;
    }
    const path = join(this.env.STORAGE_PATH, 'mail');
    await mkdir(path, { recursive: true, mode: 0o700 });
    const data = await nodemailer
      .createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
      .sendMail(mail);
    await writeFile(join(path, `${id}.eml`), data.message as Buffer, { mode: 0o600 });
  }
  onModuleDestroy() {
    this.smtp?.close();
  }
}
