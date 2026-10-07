import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { EmailService } from './email.service.js';
import { EmailWorker } from './email.worker.js';
import { NotificationsController } from './notifications.controller.js';
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, EmailWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
