import { Module } from '@nestjs/common';
import { DepartmentController } from './departments.controller.js';
import { DepartmentService } from './departments.service.js';
@Module({ controllers: [DepartmentController], providers: [DepartmentService] })
export class DepartmentModule {}
