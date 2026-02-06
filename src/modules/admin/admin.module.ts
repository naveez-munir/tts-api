import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { StripeModule } from '../../integrations/stripe/stripe.module.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { BiddingQueueModule } from '../../queue/bidding-queue.module.js';
import { S3Module } from '../../integrations/s3/s3.module.js';
import { NotificationsModule } from '../../integrations/notifications/notifications.module.js';
import { PayoutsModule } from '../payouts/payouts.module.js';
import { OperatorsModule } from '../operators/operators.module.js';

@Module({
  imports: [StripeModule, SystemSettingsModule, BiddingQueueModule, S3Module, NotificationsModule, PayoutsModule, OperatorsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

