import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { ResendModule } from '../resend/resend.module.js';
import { TwilioModule } from '../twilio/twilio.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { SystemSettingsModule } from '../../modules/system-settings/system-settings.module.js';

@Module({
  imports: [ResendModule, TwilioModule, DatabaseModule, SystemSettingsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

