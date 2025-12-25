import { Injectable } from '@nestjs/common';
import { GoogleMapsService } from '../../integrations/google-maps/google-maps.service';
import { PricingService } from '../../pricing/pricing.service';
import { VehicleType, ServiceType } from '../../common/enums';
import { QuoteRequestDto } from '../dto';

export interface QuoteSurcharge {
  type: string;
  description: string;
  amount: number;
}

export interface QuoteDiscount {
  type: string;
  description: string;
  amount: number;
}

export interface QuoteResult {
  distanceMiles: number;
  durationMinutes: number;
  baseFare: number;
  distanceCharge: number;
  surcharges: QuoteSurcharge[];
  discounts: QuoteDiscount[];
  totalPrice: number;
  currency: string;
}

@Injectable()
export class QuoteService {
  constructor(
    private googleMapsService: GoogleMapsService,
    private pricingService: PricingService,
  ) {}

  async calculateQuote(request: QuoteRequestDto): Promise<QuoteResult> {
    // Calculate distance and duration
    const distance = await this.googleMapsService.calculateDistance(
      { lat: request.pickupLocation.lat, lng: request.pickupLocation.lng },
      { lat: request.dropoffLocation.lat, lng: request.dropoffLocation.lng },
      request.viaPoints?.map((p) => ({ lat: p.lat, lng: p.lng })),
    );

    // Get pricing components
    const baseFare = await this.pricingService.getBaseFare(request.vehicleType);
    const perMileRate = await this.pricingService.getPerMileRate(request.vehicleType);
    const distanceCharge = distance.distanceMiles * perMileRate;

    const surcharges: QuoteSurcharge[] = [];
    const discounts: QuoteDiscount[] = [];

    // Meet and Greet
    if (request.hasMeetAndGreet) {
      const meetAndGreetFee = await this.pricingService.getMeetAndGreetFee();
      surcharges.push({
        type: 'MEET_AND_GREET',
        description: 'Meet & Greet service',
        amount: meetAndGreetFee,
      });
    }

    // Airport fee (detect from service type)
    if (
      request.serviceType === ServiceType.AIRPORT_PICKUP ||
      request.serviceType === ServiceType.AIRPORT_DROPOFF
    ) {
      // Extract airport code from postcode (simplified - in production would use proper mapping)
      const airportCode = this.detectAirportFromPostcode(
        request.serviceType === ServiceType.AIRPORT_PICKUP
          ? request.pickupLocation.postcode
          : request.dropoffLocation.postcode,
      );

      if (airportCode) {
        const airportFee = await this.pricingService.getAirportFee(airportCode);
        if (airportFee > 0) {
          surcharges.push({
            type: 'AIRPORT_FEE',
            description: `${airportCode} airport fee`,
            amount: airportFee,
          });
        }
      }
    }

    // Time-based surcharge (night rate)
    const pickupDate = new Date(request.pickupDatetime);
    const timeSurcharge = await this.pricingService.getTimeSurcharge(pickupDate);
    if (timeSurcharge) {
      const surchargeAmount =
        (baseFare + distanceCharge) * (timeSurcharge.percentage / 100);
      surcharges.push({
        type: 'TIME_SURCHARGE',
        description: timeSurcharge.description,
        amount: Math.round(surchargeAmount * 100) / 100,
      });
    }

    // Holiday surcharge
    const holidaySurcharge = await this.pricingService.getHolidaySurcharge(pickupDate);
    if (holidaySurcharge) {
      const surchargeAmount =
        (baseFare + distanceCharge) * (holidaySurcharge.percentage / 100);
      surcharges.push({
        type: 'HOLIDAY_SURCHARGE',
        description: holidaySurcharge.description,
        amount: Math.round(surchargeAmount * 100) / 100,
      });
    }

    // Calculate subtotal before discounts
    const totalSurcharges = surcharges.reduce((sum, s) => sum + s.amount, 0);
    let subtotal = baseFare + distanceCharge + totalSurcharges;

    // Return journey discount (5%)
    if (request.isReturnJourney) {
      const discountAmount = subtotal * 0.05;
      discounts.push({
        type: 'RETURN_JOURNEY',
        description: 'Return journey discount (5%)',
        amount: Math.round(discountAmount * 100) / 100,
      });
    }

    // Calculate final total
    const totalDiscounts = discounts.reduce((sum, d) => sum + d.amount, 0);
    const totalPrice = Math.round((subtotal - totalDiscounts) * 100) / 100;

    return {
      distanceMiles: distance.distanceMiles,
      durationMinutes: distance.durationMinutes,
      baseFare,
      distanceCharge: Math.round(distanceCharge * 100) / 100,
      surcharges,
      discounts,
      totalPrice,
      currency: 'GBP',
    };
  }

  private detectAirportFromPostcode(postcode: string): string | null {
    const pc = postcode.toUpperCase().replace(/\s/g, '');

    // Simplified airport detection based on postcode prefixes
    const airportMap: Record<string, string> = {
      TW6: 'LHR', // Heathrow
      UB7: 'LHR',
      RH6: 'LGW', // Gatwick
      CM24: 'STN', // Stansted
      LU2: 'LTN', // Luton
      SS2: 'SEN', // Southend
      M90: 'MAN', // Manchester
      B26: 'BHX', // Birmingham
      LS19: 'LBA', // Leeds Bradford
      BS48: 'BRS', // Bristol
      EH12: 'EDI', // Edinburgh
      PA3: 'GLA', // Glasgow
    };

    for (const [prefix, code] of Object.entries(airportMap)) {
      if (pc.startsWith(prefix)) {
        return code;
      }
    }

    return null;
  }
}
