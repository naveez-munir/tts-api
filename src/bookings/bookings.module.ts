import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { QuoteService } from './services/quote.service';
import { Booking } from './entities/booking.entity';
import { Transaction } from './entities/transaction.entity';
import { PricingModule } from '../pricing/pricing.module';
import { GoogleMapsModule } from '../integrations/google-maps/google-maps.module';
import { StripeModule } from '../integrations/stripe/stripe.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Transaction]),
    PricingModule,
    GoogleMapsModule,
    StripeModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, QuoteService],
  exports: [BookingsService],
})
export class BookingsModule {}
