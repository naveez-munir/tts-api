import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeService } from './stripe.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { DatabaseModule } from '../../database/database.module.js';
import { JobsModule } from '../../modules/jobs/jobs.module.js';
import { SystemSettingsModule } from '../../modules/system-settings/system-settings.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [ConfigModule, DatabaseModule, JobsModule, SystemSettingsModule, NotificationsModule],
  controllers: [StripeWebhookController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}

