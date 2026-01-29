import { Module } from '@nestjs/common';
import { OperatorsService } from './operators.service.js';
import { OperatorsController } from './operators.controller.js';
import { DocumentExpirySchedulerService } from './document-expiry-scheduler.service.js';
import { NotificationsModule } from '../../integrations/notifications/notifications.module.js';
import { BiddingQueueModule } from '../../queue/bidding-queue.module.js';
import { S3Module } from '../../integrations/s3/s3.module.js';

@Module({
  imports: [NotificationsModule, BiddingQueueModule, S3Module],
  controllers: [OperatorsController],
  providers: [OperatorsService, DocumentExpirySchedulerService],
  exports: [OperatorsService],
})
export class OperatorsModule {}

