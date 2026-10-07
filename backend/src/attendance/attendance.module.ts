import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { RegularizationService } from './regularization.service.js';
import { AttendanceController } from './attendance.controller.js';
@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, RegularizationService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
