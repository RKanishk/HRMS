import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Api } from '../common/api.js';
import { CurrentUser, Permissions } from '../auth/decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { PageQuery } from '../common/dto.js';
import { LifecycleService } from '../onboarding/lifecycle.service.js';
import { OnboardingDto, TaskDto } from '../onboarding/lifecycle.dto.js';
@ApiTags('Onboarding')
@Controller('onboarding')
@Permissions('lifecycle.manage')
export class OnboardingController {
  constructor(private service: LifecycleService) {}
  @Get() @Api('List onboarding checklists', 'LifecycleCase', 200, true) list(
    @Query() q: PageQuery,
  ) {
    return this.service.list('ONBOARDING', q);
  }
  @Post() @Api('Open onboarding checklist', 'LifecycleCase', 201) create(
    @CurrentUser() u: Principal,
    @Body() d: OnboardingDto,
  ) {
    return this.service.create(u, 'ONBOARDING', d);
  }
  @Patch(':id/tasks/:taskId') @Api('Update checklist task', 'ChecklistTask') task(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() d: TaskDto,
  ) {
    return this.service.task(u, 'ONBOARDING', id, taskId, d.completed);
  }
  @Post(':id/complete') @Api('Validate and complete onboarding', 'LifecycleCase', 201) complete(
    @CurrentUser() u: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.complete(u, 'ONBOARDING', id);
  }
}
