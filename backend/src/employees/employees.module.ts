import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { ProfileService } from './profile.service.js';
@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, ProfileService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
