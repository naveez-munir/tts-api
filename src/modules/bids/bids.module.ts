import { Module } from '@nestjs/common';
import { BidsService } from './bids.service.js';
import { BidsController } from './bids.controller.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { NotificationsModule } from '../../integrations/notifications/notifications.module.js';
import { BiddingQueueModule } from '../../queue/bidding-queue.module.js';

@Module({
  imports: [SystemSettingsModule, NotificationsModule, BiddingQueueModule],
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}

