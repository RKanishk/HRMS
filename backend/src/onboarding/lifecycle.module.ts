import { Module } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service.js';
import { OnboardingController } from './onboarding.controller.js';
import { OffboardingController } from '../offboarding/offboarding.controller.js';
@Module({
  controllers: [OnboardingController, OffboardingController],
  providers: [LifecycleService],
})
export class LifecycleModule {}
