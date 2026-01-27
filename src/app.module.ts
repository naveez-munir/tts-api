import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { ResendModule } from './integrations/resend/resend.module.js';
import { TwilioModule } from './integrations/twilio/twilio.module.js';
import { NotificationsModule } from './integrations/notifications/notifications.module.js';
import { QueueModule } from './queue/queue.module.js';
import { BiddingQueueModule } from './queue/bidding-queue.module.js';
import { S3Module } from './integrations/s3/s3.module.js';
import { VehicleCapacityModule } from './modules/vehicle-capacity/vehicle-capacity.module.js';
import { PayoutsModule } from './modules/payouts/payouts.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 10, // 10 requests per 60 seconds (global default)
      },
    ]),
    DatabaseModule,
    QueueModule,
    BiddingQueueModule,
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
    ResendModule,
    TwilioModule,
    NotificationsModule,
    S3Module,
    VehicleCapacityModule,
    PayoutsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}