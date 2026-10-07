import { Module } from '@nestjs/common';
import { DesignationController } from './designations.controller.js';
import { DesignationService } from './designations.service.js';
@Module({ controllers: [DesignationController], providers: [DesignationService] })
export class DesignationModule {}
