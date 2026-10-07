import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
export function Api(summary: string, model = 'Result', status = 200, list = false) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiCookieAuth('access'),
    ApiResponse({
      status,
      schema: list
        ? {
            type: 'object',
            properties: {
              items: { type: 'array', items: { $ref: `#/components/schemas/${model}` } },
              meta: { $ref: '#/components/schemas/PageMeta' },
            },
            required: ['items', 'meta'],
          }
        : { $ref: `#/components/schemas/${model}` },
    }),
    ApiBadRequestResponse({
      description: 'Validation failed',
      schema: { $ref: '#/components/schemas/ApiError' },
    }),
    ApiUnauthorizedResponse({ description: 'Missing, expired or revoked session' }),
    ApiForbiddenResponse({ description: 'Insufficient permission, scope or CSRF proof' }),
    ApiNotFoundResponse({ description: 'Resource not found' }),
    ApiResponse({ status: 409, description: 'Conflict with existing data or workflow state' }),
    ApiResponse({ status: 429, description: 'Rate limit exceeded' }),
  );
}
