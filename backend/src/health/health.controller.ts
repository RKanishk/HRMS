import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { Api } from '../common/api.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../common/redis.service.js';
@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private db: PrismaService,
    private redis: RedisService,
  ) {}
  @Get('live') @Api('Liveness probe', 'Health') live() {
    return { status: 'ok' };
  }
  @Get('ready') @Api('Database and Redis readiness', 'Health') async ready() {
    try {
      await Promise.all([this.db.$queryRaw`SELECT 1`, this.redis.client.ping()]);
      return { status: 'ok', database: 'up', redis: 'up' };
    } catch {
      throw new ServiceUnavailableException('A required service is unavailable');
    }
  }
}
