import { Module } from '@nestjs/common';
import { BiddingProcessor } from './bidding.processor.js';
import { BiddingQueueService } from './bidding-queue.service.js';
import { NotificationsModule } from '../integrations/notifications/notifications.module.js';

/**
 * Bidding queue module - handles bidding window processing
 * Separated from QueueModule to avoid circular dependencies
 */
@Module({
  imports: [NotificationsModule],
  providers: [BiddingProcessor, BiddingQueueService],
  exports: [BiddingQueueService],
})
export class BiddingQueueModule {}

