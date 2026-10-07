import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';
import { Prisma } from '../generated/prisma/client.js';
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'An internal error occurred';
    let details: unknown[] = [];
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      const m = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      message = Array.isArray(m) ? 'Invalid request' : (m ?? error.message);
      details = Array.isArray(m) ? m : [];
      code =
        status === 400
          ? 'VALIDATION_ERROR'
          : status === 401
            ? 'UNAUTHENTICATED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 404
                ? 'NOT_FOUND'
                : status === 409
                  ? 'CONFLICT'
                  : status === 429
                    ? 'RATE_LIMITED'
                    : 'REQUEST_ERROR';
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P2002', 'P2003', 'P2034'].includes(error.code)) {
        status = 409;
        code = 'CONFLICT';
        message = 'The operation conflicts with existing data';
      } else if (error.code === 'P2025') {
        status = 404;
        code = 'NOT_FOUND';
        message = 'Resource not found';
      }
    }
    if (status >= 500)
      this.logger.error({
        event: 'request_failed',
        method: req.method,
        path: req.path,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      });
    res.status(status).json({
      statusCode: status,
      error: code,
      message,
      details,
      requestId: res.getHeader('x-request-id'),
    });
  }
}
