import { Module } from '@nestjs/common';
import { BiddingProcessor } from './bidding.processor.js';
import { AcceptanceProcessor } from './acceptance.processor.js';
import { BiddingQueueService } from './bidding-queue.service.js';
import { NotificationsModule } from '../integrations/notifications/notifications.module.js';
import { SystemSettingsModule } from '../modules/system-settings/system-settings.module.js';

/**
 * Bidding queue module - handles bidding window and acceptance processing
 * Separated from QueueModule to avoid circular dependencies
 */
@Module({
  imports: [NotificationsModule, SystemSettingsModule],
  providers: [BiddingProcessor, AcceptanceProcessor, BiddingQueueService],
  exports: [BiddingQueueService, AcceptanceProcessor],
})
export class BiddingQueueModule {}

