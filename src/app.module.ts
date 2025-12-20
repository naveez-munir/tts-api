import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { BidsModule } from './modules/bids/bids.module.js';
import { OperatorsModule } from './modules/operators/operators.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { GoogleMapsModule } from './integrations/google-maps/google-maps.module.js';
import { StripeModule } from './integrations/stripe/stripe.module.js';
import { SendGridModule } from './integrations/sendgrid/sendgrid.module.js';
import { TwilioModule } from './integrations/twilio/twilio.module.js';
import { NotificationsModule } from './integrations/notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    BookingsModule,
    JobsModule,
    BidsModule,
    OperatorsModule,
    PaymentsModule,
    AdminModule,
    GoogleMapsModule,
    StripeModule,
    SendGridModule,
    TwilioModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}