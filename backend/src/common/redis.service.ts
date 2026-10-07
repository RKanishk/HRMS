import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type Environment } from '../config/env.js';
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  constructor(@Inject(ENV) env: Environment) {
    this.client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, connectTimeout: 5000 });
    this.client.on('error', () => {});
  }
  async rate(key: string, seconds: number) {
    return Number(
      await this.client.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
        1,
        key,
        seconds,
      ),
    );
  }
  async onModuleDestroy() {
    await this.client.quit();
  }
}
