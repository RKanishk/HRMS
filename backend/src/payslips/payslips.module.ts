import { Module } from '@nestjs/common';
import { PayslipsController } from './payslips.controller.js';
@Module({ controllers: [PayslipsController] })
export class PayslipsModule {}
