import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  CORS_ORIGINS: z.string().min(1),
  COMPANY_TIMEZONE: z.string().default('Asia/Kolkata'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  ACCESS_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
  STORAGE_PATH: z.string().default('./storage'),
  EMAIL_DRIVER: z.enum(['local', 'smtp']).default('local'),
  EMAIL_FROM: z.string().email().default('hrms@cipl.example'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  TRUST_PROXY: z.coerce.number().int().min(0).max(3).default(0),
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).max(1000).default(10),
});
export function loadEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid configuration keys: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  const v = result.data;
  if (v.NODE_ENV === 'production' && (!v.COOKIE_SECURE || v.EMAIL_DRIVER !== 'smtp'))
    throw new Error('Production requires secure cookies and SMTP');
  if (v.COOKIE_SAME_SITE === 'none' && !v.COOKIE_SECURE)
    throw new Error('SameSite=None requires secure cookies');
  for (const origin of v.CORS_ORIGINS.split(',')) {
    const u = new URL(origin.trim());
    if (u.origin !== origin.trim() || (v.NODE_ENV === 'production' && u.protocol !== 'https:'))
      throw new Error('Invalid CORS origin');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: v.COMPANY_TIMEZONE });
  } catch {
    throw new Error('Invalid COMPANY_TIMEZONE');
  }
  if (v.EMAIL_DRIVER === 'smtp' && !v.SMTP_HOST) throw new Error('SMTP_HOST required');
  return v;
}
export type Environment = ReturnType<typeof loadEnv>;
export const ENV = Symbol('ENV');
