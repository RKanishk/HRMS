import { ConsoleLogger, type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { ENV, type Environment } from './config/env.js';
import { ErrorFilter } from './common/errors.js';
import { InputSafetyPipe } from './common/input.pipe.js';
import { responseSchemas } from './common/response-schemas.js';
export function configureApp(app: INestApplication) {
  const env = app.get<Environment>(ENV);
  app.setGlobalPrefix('api/v1');
  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', env.TRUST_PROXY);
  server.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const input = req.get('x-request-id');
    res.setHeader(
      'x-request-id',
      input && /^[a-zA-Z0-9-]{1,80}$/.test(input) ? input : randomUUID(),
    );
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useGlobalPipes(
    new InputSafetyPipe(),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  return app;
}
export function openApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('CIPL HRMS API')
    .setDescription(
      'Single-company HRMS. Cookie sessions; send credentials and X-CSRF-Token on state-changing requests. All such requests require an allowed Origin header. Dates are YYYY-MM-DD; instants include a timezone. Monetary values are decimal strings in INR. Lists return items and meta.',
    )
    .setVersion('1.0.0')
    .addCookieAuth('cipl_access', { type: 'apiKey', in: 'cookie' }, 'access')
    .addServer('http://localhost:3001', 'Local development')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  doc.components ??= {};
  doc.components.schemas = { ...responseSchemas, ...doc.components.schemas };
  for (const path of Object.values(doc.paths))
    for (const operation of Object.values(path)) {
      if (operation && typeof operation === 'object' && 'responses' in operation) {
        operation.responses['500'] = {
          description: 'Safe internal server error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        };
      }
    }
  return doc;
}
export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
    bodyParser: true,
  });
  configureApp(app);
  const doc = openApi(app);
  app.use('/api/docs', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
    );
    next();
  });
  SwaggerModule.setup('api/docs', app, doc, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      persistAuthorization: false,
      withCredentials: true,
      requestInterceptor: (request: { method: string; headers: Record<string, string> }) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
          const csrf = document.cookie
            .split('; ')
            .find((v) => v.startsWith('cipl_csrf='))
            ?.split('=')[1];
          if (csrf) request.headers['X-CSRF-Token'] = decodeURIComponent(csrf);
        }
        return request;
      },
    },
  });
  app.enableShutdownHooks();
  return app;
}
