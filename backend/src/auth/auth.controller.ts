import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Api } from '../common/api.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from './decorators.js';
import type { AuthRequest, Principal } from './auth.types.js';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from './auth.dto.js';
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}
  @Public()
  @Post('login')
  @HttpCode(200)
  @Api('Sign in; returns HTTP-only session cookies and CSRF token', 'SessionResponse')
  login(@Body() d: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.service.login(d.email, d.password, res);
  }
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Api('Rotate session using refresh cookie and x-csrf-token', 'SessionResponse')
  refresh(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    return this.service.refresh(req.cookies.cipl_refresh, req.get('x-csrf-token'), res);
  }
  @Post('logout') @HttpCode(200) @Api('Revoke current session') logout(
    @CurrentUser() u: Principal,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.logout(u, res);
  }
  @Get('me') @Api('Current identity and effective permissions', 'CurrentUser') me(
    @CurrentUser() u: Principal,
  ) {
    return this.service.me(u);
  }
  @Post('change-password') @HttpCode(200) @Api('Change password and revoke all sessions') change(
    @CurrentUser() u: Principal,
    @Body() d: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.change(u, d.currentPassword, d.newPassword, res);
  }
  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  @Api('Request password reset; always returns the same response', 'Result', 202)
  forgot(@Body() d: ForgotPasswordDto) {
    return this.service.forgot(d.email);
  }
  @Public() @Post('reset-password') @HttpCode(200) @Api('Consume a one-time reset token') reset(
    @Body() d: ResetPasswordDto,
  ) {
    return this.service.reset(d.token, d.newPassword);
  }
}
