import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service.js';
import { JobsController } from './jobs.controller.js';
import { JobsCreationService } from './jobs-creation.service.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { NotificationsModule } from '../../integrations/notifications/notifications.module.js';
import { BiddingQueueModule } from '../../queue/bidding-queue.module.js';

@Module({
  imports: [SystemSettingsModule, NotificationsModule, BiddingQueueModule],
  controllers: [JobsController],
  providers: [JobsService, JobsCreationService],
  exports: [JobsService, JobsCreationService],
})
export class JobsModule {}

