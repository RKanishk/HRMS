import { Module } from '@nestjs/common';
import { SalaryService } from './salary.service.js';
import { SalaryController } from './salary.controller.js';
@Module({ controllers: [SalaryController], providers: [SalaryService] })
export class SalaryModule {}
