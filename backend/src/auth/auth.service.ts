import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ENV, type Environment } from '../config/env.js';
import { hash, safeEqual, token } from '../common/crypto.js';
import type { Principal } from './auth.types.js';
@Injectable()
export class AuthService {
  private dummy = bcrypt.hash(token(), 12);
  constructor(
    private db: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    @Inject(ENV) private env: Environment,
  ) {}
  async passwordHash(password: string) {
    if (Buffer.byteLength(password) > 72)
      throw new BadRequestException('Password exceeds 72 UTF-8 bytes');
    return bcrypt.hash(password, 12);
  }
  private cookies(res: Response, access: string, refresh: string, csrf: string) {
    const base = {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: this.env.COOKIE_SAME_SITE,
      path: '/api/v1',
    } as const;
    res.cookie('cipl_access', access, { ...base, maxAge: this.env.ACCESS_TTL_MINUTES * 60000 });
    res.cookie('cipl_refresh', refresh, {
      ...base,
      path: '/api/v1/auth',
      maxAge: this.env.REFRESH_TTL_DAYS * 86400000,
    });
    res.cookie('cipl_csrf', csrf, {
      ...base,
      httpOnly: false,
      path: '/',
      maxAge: this.env.REFRESH_TTL_DAYS * 86400000,
    });
  }
  clear(res: Response) {
    const base = { secure: this.env.COOKIE_SECURE, sameSite: this.env.COOKIE_SAME_SITE };
    res.clearCookie('cipl_access', { ...base, path: '/api/v1' });
    res.clearCookie('cipl_refresh', { ...base, path: '/api/v1/auth' });
    res.clearCookie('cipl_csrf', { ...base, path: '/' });
  }
  async login(email: string, password: string, res: Response) {
    const u = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const valid = await bcrypt.compare(password, u?.passwordHash ?? (await this.dummy));
    if (!valid || !u?.active) throw new UnauthorizedException('Invalid email or password');
    const access = token(),
      refresh = token(),
      csrf = token();
    await this.db.atomic(async (tx) => {
      await tx.session.create({
        data: {
          userId: u.id,
          accessHash: hash(access),
          refreshHash: hash(refresh),
          csrfHash: hash(csrf),
          accessExpiresAt: new Date(Date.now() + this.env.ACCESS_TTL_MINUTES * 60000),
          expiresAt: new Date(Date.now() + this.env.REFRESH_TTL_DAYS * 86400000),
        },
      });
      await this.audit.write(tx, u.id, 'auth.login', 'User', u.id);
    });
    this.cookies(res, access, refresh, csrf);
    return { message: 'Signed in', csrfToken: csrf };
  }
  async refresh(refresh: string | undefined, csrf: string | undefined, res: Response) {
    if (!refresh) throw new UnauthorizedException();
    const access = token(),
      next = token(),
      newCsrf = token();
    await this.db.atomic(async (tx) => {
      const s = await tx.session.findUnique({
        where: { refreshHash: hash(refresh) },
        include: { user: true },
      });
      if (!s || s.revokedAt || s.expiresAt <= new Date() || !s.user.active)
        throw new UnauthorizedException();
      if (!csrf || !safeEqual(hash(csrf), s.csrfHash))
        throw new ForbiddenException('Invalid CSRF token');
      await tx.session.update({
        where: { id: s.id },
        data: {
          accessHash: hash(access),
          refreshHash: hash(next),
          csrfHash: hash(newCsrf),
          accessExpiresAt: new Date(
            Math.min(Date.now() + this.env.ACCESS_TTL_MINUTES * 60000, s.expiresAt.getTime()),
          ),
        },
      });
    });
    this.cookies(res, access, next, newCsrf);
    return { message: 'Session refreshed', csrfToken: newCsrf };
  }
  async logout(u: Principal, res: Response) {
    await this.db.session.update({ where: { id: u.sessionId }, data: { revokedAt: new Date() } });
    this.clear(res);
    return { message: 'Signed out' };
  }
  me(u: Principal) {
    return {
      id: u.id,
      email: u.email,
      employeeId: u.employeeId,
      roles: u.roles,
      permissions: u.permissions,
    };
  }
  async change(u: Principal, current: string, next: string, res: Response) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await bcrypt.compare(current, user.passwordHash)))
      throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await this.passwordHash(next);
    await this.db.atomic(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: u.id, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (changed.count !== 1) throw new UnauthorizedException('Password changed; sign in again');
      await tx.session.updateMany({ where: { userId: u.id }, data: { revokedAt: new Date() } });
      await tx.passwordReset.updateMany({
        where: { userId: u.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.audit.write(tx, u.id, 'auth.password_changed', 'User', u.id);
    });
    this.clear(res);
    return { message: 'Password changed. Sign in again.' };
  }
  async forgot(email: string) {
    const u = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (u?.active) {
      const secret = token();
      await this.db.atomic(async (tx) => {
        await tx.passwordReset.updateMany({
          where: { userId: u.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.passwordReset.create({
          data: {
            userId: u.id,
            tokenHash: hash(secret),
            expiresAt: new Date(Date.now() + 30 * 60000),
          },
        });
        await this.notifications.email(tx, {
          to: u.email,
          subject: 'Reset your CIPL HRMS password',
          text: `Open ${this.env.FRONTEND_URL}/reset-password#token=${secret} within 30 minutes. If you did not request this, ignore it.`,
        });
      });
    }
    return { message: 'If the account is eligible, reset instructions will be sent.' };
  }
  async reset(secret: string, password: string) {
    const passwordHash = await this.passwordHash(password);
    await this.db.atomic(async (tx) => {
      const r = await tx.passwordReset.findUnique({
        where: { tokenHash: hash(secret) },
        include: { user: true },
      });
      if (!r || r.usedAt || r.expiresAt <= new Date() || !r.user.active)
        throw new BadRequestException('Reset token is invalid or expired');
      await tx.passwordReset.update({ where: { id: r.id }, data: { usedAt: new Date() } });
      await tx.user.update({ where: { id: r.userId }, data: { passwordHash } });
      await tx.session.updateMany({ where: { userId: r.userId }, data: { revokedAt: new Date() } });
      await this.audit.write(tx, r.userId, 'auth.password_reset', 'User', r.userId);
    });
    return { message: 'Password reset. Sign in again.' };
  }
}
