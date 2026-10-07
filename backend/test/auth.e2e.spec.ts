import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/bootstrap.js';

describe('CIPL HRMS HTTP contract', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  let csrf = '';

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  test('liveness is public and protected records require a session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' });
    await request(app.getHttpServer()).get('/api/v1/employees').expect(401);
  });

  test('login, current user and CSRF enforcement work together', async () => {
    await agent
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'admin@cipl.example',
        password: process.env.SEED_PASSWORD ?? 'SeedOnly!Cipl2026',
      })
      .expect(200)
      .then((response) => {
        expect(response.body.message).toBe('Signed in');
        expect(response.body.csrfToken).toEqual(expect.any(String));
        csrf = response.body.csrfToken;
      });
    await agent
      .get('/api/v1/auth/me')
      .expect(200)
      .expect((response) => {
        expect(response.body.roles).toContain('SUPER_ADMIN');
        expect(response.body.permissions).toContain('payroll.approve');
      });
    await agent
      .post('/api/v1/branches')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Missing CSRF', code: `NO-CSRF-${Date.now()}` })
      .expect(403);
    await agent
      .post('/api/v1/branches')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'E2E Branch', code: `E2E-${Date.now()}` })
      .expect(201);
  });

  test('employee session cannot read payroll or create organization records', async () => {
    const employee = request.agent(app.getHttpServer());
    const response = await employee
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'employee02@cipl.example',
        password: process.env.SEED_PASSWORD ?? 'SeedOnly!Cipl2026',
      })
      .expect(200);
    const employeeCsrf = response.body.csrfToken as string;
    await employee.get('/api/v1/payroll/runs').expect(403);
    await employee
      .post('/api/v1/departments')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', employeeCsrf)
      .send({ name: 'Forbidden Department', code: `NO-${Date.now()}` })
      .expect(403);
    await employee
      .get('/api/v1/employees')
      .expect(200)
      .expect((body) => {
        expect(body.body.items).toHaveLength(1);
        expect(body.body.items[0].email).toBe('employee02@cipl.example');
      });
  });
});
