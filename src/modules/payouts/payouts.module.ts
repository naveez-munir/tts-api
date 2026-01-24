import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service.js';
import { PayoutsController } from './payouts.controller.js';
import { PayoutSchedulerService } from './payout-scheduler.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { ResendModule } from '../../integrations/resend/resend.module.js';

@Module({
  imports: [DatabaseModule, SystemSettingsModule, ResendModule],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutSchedulerService],
  exports: [PayoutsService, PayoutSchedulerService],
})
export class PayoutsModule {}

