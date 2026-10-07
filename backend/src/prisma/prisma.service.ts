import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { ENV, type Environment } from '../config/env.js';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) env: Environment) {
    super({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: 10 }),
      log: ['error'],
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  async atomic<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.$transaction(
          async (tx) => {
            // This function returns PostgreSQL void, which Prisma cannot deserialize.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(2802026)`;
            return fn(tx);
          },
          { isolationLevel: 'Serializable', timeout: 60000, maxWait: 15000 },
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034' && attempt < 3)
          continue;
        throw e;
      }
    }
  }
}
