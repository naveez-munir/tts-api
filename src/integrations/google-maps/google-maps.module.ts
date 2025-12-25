import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleMapsService } from './google-maps.service.js';
import { GoogleMapsController } from './google-maps.controller.js';
import { QuoteService } from './quote.service.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [GoogleMapsController],
  providers: [GoogleMapsService, QuoteService],
  exports: [GoogleMapsService, QuoteService],
})
export class GoogleMapsModule {}

