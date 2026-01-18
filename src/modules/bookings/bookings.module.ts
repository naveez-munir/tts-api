import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { BookingsController } from './bookings.controller.js';
import { VehicleCapacityModule } from '../vehicle-capacity/vehicle-capacity.module.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { GoogleMapsModule } from '../../integrations/google-maps/google-maps.module.js';
import { StripeModule } from '../../integrations/stripe/stripe.module.js';
import { NotificationsModule } from '../../integrations/notifications/notifications.module.js';

@Module({
  imports: [
    VehicleCapacityModule,
    SystemSettingsModule,
    GoogleMapsModule,
    StripeModule,
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}

