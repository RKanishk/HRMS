import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { RangeQuery, ReviewDto } from '../common/dto.js';
import { AttendanceService } from './attendance.service.js';
import { RegularizationService } from './regularization.service.js';
import { AttendanceQuery, CalculateDto, PunchDto, RegularizationDto } from './attendance.dto.js';
@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(
    private service: AttendanceService,
    private regularization: RegularizationService,
  ) {}
  @Get()
  @Permissions('attendance.view')
  @Api('List calculated attendance within scope', 'Attendance', 200, true)
  list(@CurrentUser() u: Principal, @Query() q: AttendanceQuery) {
    return this.service.list(u, q);
  }
  @Get('punches')
  @Permissions('attendance.view')
  @Api('List immutable raw punches', 'RawPunch', 200, true)
  punches(@CurrentUser() u: Principal, @Query() q: AttendanceQuery) {
    return this.service.punches(u, q);
  }
  @Post('punches')
  @Permissions('attendance.punch')
  @Api('Check in/out; idempotent externalId', 'PunchResult', 201)
  punch(@CurrentUser() u: Principal, @Body() d: PunchDto) {
    return this.service.punch(u, d);
  }
  @Post('calculate')
  @Permissions('attendance.manage')
  @Api('Recalculate 1–62 days; preserves approved corrections', 'AttendanceResult', 201)
  calculate(@CurrentUser() u: Principal, @Body() d: CalculateDto) {
    return this.service.calculate(u, d);
  }
  @Post('import')
  @Permissions('attendance.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Api('Atomically import biometric CSV; duplicate event IDs are idempotent', 'ImportResult', 201)
  import(@CurrentUser() u: Principal, @UploadedFile() file: Express.Multer.File) {
    return this.service.import(u, file);
  }
  @Get('regularizations')
  @Permissions('attendance.view')
  @Api('List scoped correction requests', 'Regularization', 200, true)
  requests(@CurrentUser() u: Principal, @Query() q: RangeQuery) {
    return this.regularization.list(u, q);
  }
  @Post('regularizations')
  @Permissions('attendance.regularize')
  @Api('Request own attendance correction', 'Regularization', 201)
  request(@CurrentUser() u: Principal, @Body() d: RegularizationDto) {
    return this.regularization.request(u, d);
  }
  @Post('regularizations/:id/review')
  @Permissions('attendance.approve')
  @Api('Approve/reject correction; self approval prohibited', 'Regularization', 201)
  review(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReviewDto,
  ) {
    return this.regularization.review(u, id, d);
  }
}
