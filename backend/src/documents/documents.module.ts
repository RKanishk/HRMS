import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { LocalObjectStorage, ObjectStorage } from './storage.js';
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, { provide: ObjectStorage, useClass: LocalObjectStorage }],
})
export class DocumentsModule {}
