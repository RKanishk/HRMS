import { Module } from '@nestjs/common';
import { BranchController } from './branches.controller.js';
import { BranchService } from './branches.service.js';
@Module({ controllers: [BranchController], providers: [BranchService] })
export class BranchModule {}
