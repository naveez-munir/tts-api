import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { SendGridModule } from '../sendgrid/sendgrid.module.js';
import { TwilioModule } from '../twilio/twilio.module.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [SendGridModule, TwilioModule, DatabaseModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

