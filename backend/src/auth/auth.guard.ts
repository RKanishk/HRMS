import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../common/redis.service.js';
import { ENV, type Environment } from '../config/env.js';
import { hash, safeEqual } from '../common/crypto.js';
import type { AuthRequest } from './auth.types.js';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private db: PrismaService,
    private redis: RedisService,
    @Inject(ENV) private env: Environment,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutating) {
      const origin = req.get('origin');
      if (
        !origin ||
        !this.env.CORS_ORIGINS.split(',')
          .map((s) => s.trim())
          .includes(origin)
      )
        throw new ForbiddenException('An allowed Origin header is required');
    }
    if (req.path.startsWith('/api/v1/auth/') && mutating) {
      let count: number;
      try {
        count = await this.redis.rate(`auth:${hash(req.ip ?? 'unknown')}`, 60);
      } catch {
        throw new ServiceUnavailableException('Authentication temporarily unavailable');
      }
      if (count > this.env.AUTH_RATE_LIMIT) throw new HttpException('Too many attempts', 429);
    }
    if (this.reflector.getAllAndOverride<boolean>('public', [ctx.getHandler(), ctx.getClass()]))
      return true;
    const access = req.cookies.cipl_access;
    if (!access) throw new UnauthorizedException();
    const s = await this.db.session.findUnique({
      where: { accessHash: hash(access) },
      include: {
        user: {
          include: {
            roles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        },
      },
    });
    if (
      !s ||
      s.revokedAt ||
      s.accessExpiresAt <= new Date() ||
      s.expiresAt <= new Date() ||
      !s.user.active
    )
      throw new UnauthorizedException();
    req.user = {
      id: s.user.id,
      email: s.user.email,
      employeeId: s.user.employeeId,
      roles: s.user.roles.map((r) => r.role.name),
      permissions: [
        ...new Set(s.user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code))),
      ],
      sessionId: s.id,
      csrfHash: s.csrfHash,
    };
    if (
      mutating &&
      (!req.get('x-csrf-token') || !safeEqual(hash(req.get('x-csrf-token')!), s.csrfHash))
    )
      throw new ForbiddenException('Invalid CSRF token');
    const permissions =
      this.reflector.getAllAndOverride<string[]>('permissions', [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    if (!permissions.every((p) => req.user.permissions.includes(p)))
      throw new ForbiddenException('Insufficient permission');
    return true;
  }
}
