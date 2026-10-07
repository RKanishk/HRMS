import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthRequest } from './auth.types.js';
export const Public = () => SetMetadata('public', true);
export const Permissions = (...permissions: string[]) => SetMetadata('permissions', permissions);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthRequest>().user,
);
