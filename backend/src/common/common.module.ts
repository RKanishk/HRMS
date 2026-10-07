import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from './redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ScopeService } from './scope.service.js';
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: loadEnv },
    PrismaService,
    RedisService,
    AuditService,
    ScopeService,
  ],
  exports: [ENV, PrismaService, RedisService, AuditService, ScopeService],
})
export class CommonModule {}
