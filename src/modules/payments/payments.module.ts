import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { StripeModule } from '../../integrations/stripe/stripe.module.js';
import { NotificationsModule } from '../../integrations/notifications/notifications.module.js';
import { BiddingQueueModule } from '../../queue/bidding-queue.module.js';

@Module({
  imports: [StripeModule, NotificationsModule, BiddingQueueModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

