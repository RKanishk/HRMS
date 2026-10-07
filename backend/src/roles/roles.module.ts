import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller.js';
import { PermissionsController } from '../permissions/permissions.controller.js';
@Module({ controllers: [RolesController, PermissionsController] })
export class RolesModule {}
