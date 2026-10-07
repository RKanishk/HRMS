import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { LeaveService } from './leave.service.js';
import { LeaveController } from './leave.controller.js';
@Module({ imports: [AttendanceModule], controllers: [LeaveController], providers: [LeaveService] })
export class LeaveModule {}
