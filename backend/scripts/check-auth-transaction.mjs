// Focused API regression test using an isolated in-memory PostgreSQL engine.
// Redis is stubbed here; this does not replace the full Docker/Redis E2E suite.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { AuthController } from '../dist/src/auth/auth.controller.js';
import { AuthService } from '../dist/src/auth/auth.service.js';
import { AuthGuard } from '../dist/src/auth/auth.guard.js';
import { AuditService } from '../dist/src/audit/audit.service.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';
import { RedisService } from '../dist/src/common/redis.service.js';
import { NotificationsService } from '../dist/src/notifications/notifications.service.js';
import { ENV, loadEnv } from '../dist/src/config/env.js';
import { configureApp } from '../dist/src/bootstrap.js';
import { seed } from '../dist/prisma/seed.js';

// These values are isolated test configuration, never the user's database.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:45439/postgres',
  REDIS_URL: 'redis://127.0.0.1:1/0',
  FRONTEND_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3001',
  COOKIE_SECURE: 'false',
  COOKIE_SAME_SITE: 'lax',
  DATA_ENCRYPTION_KEY: '0'.repeat(64),
  EMAIL_DRIVER: 'local',
  AUTH_RATE_LIMIT: '1000',
});

const engine = await PGlite.create();
const server = new PGLiteSocketServer({ db: engine, port: 45439, host: '127.0.0.1' });
let app;
try {
  const migrationsDir = new URL('../prisma/migrations/', import.meta.url);
  for (const entry of (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const path = new URL(`${entry.name}/migration.sql`, migrationsDir);
    await engine.exec(await readFile(fileURLToPath(path), 'utf8'));
  }
  await server.start();
  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      AuthService,
      AuditService,
      PrismaService,
      { provide: ENV, useValue: loadEnv() },
      { provide: RedisService, useValue: { rate: async () => 1 } },
      { provide: NotificationsService, useValue: {} },
      { provide: APP_GUARD, useClass: AuthGuard },
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  const db = app.get(PrismaService);
  await seed(db);
  const agent = request.agent(app.getHttpServer());

  const malformed = await agent
    .post('/api/v1/auth/login')
    .set('Origin', 'http://localhost:3001')
    .send({ email: null, password: 'SeedOnly!Cipl2026' });
  assert.equal(malformed.status, 400, JSON.stringify(malformed.body));

  const invalid = await agent
    .post('/api/v1/auth/login')
    .set('Origin', 'http://localhost:3001')
    .send({ email: 'admin@cipl.example', password: 'IncorrectPassword!2026' });
  assert.equal(invalid.status, 401, JSON.stringify(invalid.body));
  assert.equal(await db.session.count(), 0);

  const login = await agent
    .post('/api/v1/auth/login')
    .set('Origin', 'http://localhost:3001')
    .send({ email: 'admin@cipl.example', password: 'SeedOnly!Cipl2026' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const cookies = login.headers['set-cookie'] ?? [];
  for (const name of ['cipl_access', 'cipl_refresh', 'cipl_csrf']) {
    assert.ok(cookies.some((cookie) => cookie.startsWith(`${name}=`)));
  }
  assert.equal(await db.session.count(), 1);
  assert.equal(await db.auditLog.count({ where: { action: 'auth.login' } }), 1);

  const me = await agent.get('/api/v1/auth/me');
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.email, 'admin@cipl.example');
  assert.ok(me.body.roles.includes('SUPER_ADMIN'));

  const held = await db.atomic(
    (tx) => tx.$queryRaw`
    SELECT count(*)::int AS held FROM pg_locks
    WHERE locktype = 'advisory' AND granted AND pid = pg_backend_pid()
  `,
  );
  assert.equal(held[0].held, 1);
  const released = await db.$queryRaw`
    SELECT count(*)::int AS held FROM pg_locks WHERE locktype = 'advisory' AND granted
  `;
  assert.equal(released[0].held, 0);

  const rollback = new Error('Expected test rollback');
  await assert.rejects(
    db.atomic(async (tx) => {
      await tx.user.update({ where: { email: 'admin@cipl.example' }, data: { active: false } });
      throw rollback;
    }),
    (error) => error === rollback,
  );
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { email: 'admin@cipl.example' } })).active,
    true,
  );
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        malformedInput: 400,
        invalidLogin: 401,
        validLogin: 200,
        currentUser: 200,
        sessionAndAuditPersisted: true,
        advisoryLockHeldAndReleased: true,
        rollbackPreserved: true,
        database: 'isolated PGlite PostgreSQL',
        redis: 'stubbed for this focused test',
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  await server.stop();
  await engine.close();
}
