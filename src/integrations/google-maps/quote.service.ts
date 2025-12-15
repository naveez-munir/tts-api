import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { GoogleMapsService } from './google-maps.service.js';
import type { DistanceResult } from './google-maps.service.js';
import { VehicleType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Single journey quote request
export interface SingleJourneyQuoteRequest {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: VehicleType;
  pickupDatetime: string;
  meetAndGreet?: boolean;
}

// Return journey quote request
export interface ReturnJourneyQuoteRequest {
  outbound: SingleJourneyQuoteRequest;
  returnJourney: SingleJourneyQuoteRequest;
}

// Legacy interface for backward compatibility
export interface QuoteRequest extends SingleJourneyQuoteRequest {
  isReturnJourney?: boolean;
}

// Single journey quote result
export interface SingleJourneyQuote {
  baseFare: number;
  distanceCharge: number;
  timeSurcharge: number;
  holidaySurcharge: number;
  meetAndGreetFee: number;
  totalPrice: number;
  distance: DistanceResult | null;
  breakdown: QuoteBreakdown;
}

// Return journey quote result (both legs)
export interface ReturnJourneyQuote {
  outbound: SingleJourneyQuote;
  returnJourney: SingleJourneyQuote;
  subtotal: number;           // Sum of both legs
  discountPercent: number;    // 5%
  discountAmount: number;     // Actual discount
  totalPrice: number;         // Final price after discount
}

// Legacy response for backward compatibility
export interface QuoteResponse {
  baseFare: number;
  distanceCharge: number;
  timeSurcharge: number;
  holidaySurcharge: number;
  meetAndGreetFee: number;
  returnDiscount: number;
  totalPrice: number;
  distance: DistanceResult | null;
  breakdown: QuoteBreakdown;
}

export interface QuoteBreakdown {
  baseFare: string;
  perMileRate: string;
  distanceMiles: string;
  distanceCharge: string;
  timeSurchargePercent: string;
  holidaySurchargePercent: string;
  meetAndGreetFee: string;
  returnDiscountPercent: string;
  subtotal: string;
  total: string;
}

// Pricing rule types
const RULE_TYPES = {
  BASE_FARE: 'BASE_FARE',
  PER_MILE_RATE: 'PER_MILE_RATE',
  NIGHT_SURCHARGE: 'NIGHT_SURCHARGE',
  PEAK_SURCHARGE: 'PEAK_SURCHARGE',
  HOLIDAY_SURCHARGE: 'HOLIDAY_SURCHARGE',
  MEET_AND_GREET: 'MEET_AND_GREET',
  RETURN_DISCOUNT: 'RETURN_DISCOUNT',
} as const;

// Default pricing values
const DEFAULT_PRICING = {
  [VehicleType.SALOON]: { baseFare: 15, perMile: 2.5 },
  [VehicleType.ESTATE]: { baseFare: 18, perMile: 2.75 },
  [VehicleType.MPV]: { baseFare: 25, perMile: 3.0 },
  [VehicleType.EXECUTIVE]: { baseFare: 35, perMile: 4.0 },
  [VehicleType.MINIBUS]: { baseFare: 50, perMile: 4.5 },
};

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  async calculateQuote(request: QuoteRequest): Promise<QuoteResponse> {
    // Get distance from Google Maps
    const distance = await this.googleMapsService.calculateDistance(
      request.pickupLat,
      request.pickupLng,
      request.dropoffLat,
      request.dropoffLng,
    );

    if (!distance) {
      throw new Error('Unable to calculate distance');
    }

    // Get pricing rules from database
    const pricingRules = await this.prisma.pricingRule.findMany({
      where: { isActive: true },
    });

    // Calculate base fare
    const baseFare = this.getBaseFare(request.vehicleType, pricingRules);

    // Calculate distance charge
    const perMileRate = this.getPerMileRate(request.vehicleType, pricingRules);
    const distanceCharge = distance.distanceMiles * perMileRate;

    // Calculate time-based surcharges
    const pickupTime = new Date(request.pickupDatetime);
    const timeSurchargePercent = this.getTimeSurchargePercent(pickupTime, pricingRules);
    const timeSurcharge = (baseFare + distanceCharge) * (timeSurchargePercent / 100);

    // Calculate holiday surcharge
    const holidaySurchargePercent = this.getHolidaySurchargePercent(pickupTime, pricingRules);
    const holidaySurcharge = (baseFare + distanceCharge) * (holidaySurchargePercent / 100);

    // Meet and greet fee
    const meetAndGreetFee = request.meetAndGreet
      ? this.getMeetAndGreetFee(pricingRules)
      : 0;

    // Calculate subtotal
    let subtotal = baseFare + distanceCharge + timeSurcharge + holidaySurcharge + meetAndGreetFee;

    // Return journey discount
    let returnDiscount = 0;
    const returnDiscountPercent = request.isReturnJourney
      ? this.getReturnDiscountPercent(pricingRules)
      : 0;

    if (request.isReturnJourney) {
      // For return journeys, double the fare then apply 5% discount
      subtotal = subtotal * 2;
      returnDiscount = subtotal * (returnDiscountPercent / 100);
    }

    const totalPrice = subtotal - returnDiscount;

    return {
      baseFare: this.round(baseFare),
      distanceCharge: this.round(distanceCharge),
      timeSurcharge: this.round(timeSurcharge),
      holidaySurcharge: this.round(holidaySurcharge),
      meetAndGreetFee: this.round(meetAndGreetFee),
      returnDiscount: this.round(returnDiscount),
      totalPrice: this.round(totalPrice),
      distance,
      breakdown: {
        baseFare: `£${this.round(baseFare).toFixed(2)}`,
        perMileRate: `£${perMileRate.toFixed(2)}/mile`,
        distanceMiles: `${distance.distanceMiles.toFixed(1)} miles`,
        distanceCharge: `£${this.round(distanceCharge).toFixed(2)}`,
        timeSurchargePercent: `${timeSurchargePercent}%`,
        holidaySurchargePercent: `${holidaySurchargePercent}%`,
        meetAndGreetFee: `£${this.round(meetAndGreetFee).toFixed(2)}`,
        returnDiscountPercent: `${returnDiscountPercent}%`,
        subtotal: `£${this.round(subtotal).toFixed(2)}`,
        total: `£${this.round(totalPrice).toFixed(2)}`,
      },
    };
  }

  private getBaseFare(
    vehicleType: VehicleType,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): number {
    const rule = rules.find(
      (r) => r.ruleType === RULE_TYPES.BASE_FARE && r.vehicleType === vehicleType,
    );
    return rule ? Number(rule.baseValue) : DEFAULT_PRICING[vehicleType].baseFare;
  }

  private getPerMileRate(
    vehicleType: VehicleType,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): number {
    const rule = rules.find(
      (r) => r.ruleType === RULE_TYPES.PER_MILE_RATE && r.vehicleType === vehicleType,
    );
    return rule ? Number(rule.baseValue) : DEFAULT_PRICING[vehicleType].perMile;
  }

  private getTimeSurchargePercent(
    pickupTime: Date,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): number {
    const hour = pickupTime.getHours();

    // Night surcharge: 10pm - 6am (22:00 - 06:00)
    if (hour >= 22 || hour < 6) {
      const rule = rules.find((r) => r.ruleType === RULE_TYPES.NIGHT_SURCHARGE);
      return rule ? Number(rule.baseValue) : 25; // Default 25% night surcharge
    }

    // Peak surcharge: 7am-9am and 5pm-7pm (weekdays)
    const dayOfWeek = pickupTime.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isPeakHour = (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19);

    if (isWeekday && isPeakHour) {
      const rule = rules.find((r) => r.ruleType === RULE_TYPES.PEAK_SURCHARGE);
      return rule ? Number(rule.baseValue) : 10; // Default 10% peak surcharge
    }

    return 0;
  }

  private getHolidaySurchargePercent(
    pickupTime: Date,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): number {
    const month = pickupTime.getMonth();
    const day = pickupTime.getDate();

    // Christmas: Dec 24-26
    // New Year: Dec 31, Jan 1
    const isChristmas = month === 11 && day >= 24 && day <= 26;
    const isNewYear = (month === 11 && day === 31) || (month === 0 && day === 1);

    if (isChristmas || isNewYear) {
      const rule = rules.find((r) => r.ruleType === RULE_TYPES.HOLIDAY_SURCHARGE);
      return rule ? Number(rule.baseValue) : 50; // Default 50% holiday surcharge
    }

    return 0;
  }

  private getMeetAndGreetFee(
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): number {
    const rule = rules.find((r) => r.ruleType === RULE_TYPES.MEET_AND_GREET);
    return rule ? Number(rule.baseValue) : 10; // Default £10 meet & greet
  }

  private getReturnDiscountPercent(
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): number {
    const rule = rules.find((r) => r.ruleType === RULE_TYPES.RETURN_DISCOUNT);
    return rule ? Number(rule.baseValue) : 5; // Default 5% return discount
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate quote for a single journey (one-way)
   */
  async calculateSingleJourneyQuote(request: SingleJourneyQuoteRequest): Promise<SingleJourneyQuote> {
    const distance = await this.googleMapsService.calculateDistance(
      request.pickupLat,
      request.pickupLng,
      request.dropoffLat,
      request.dropoffLng,
    );

    if (!distance) {
      throw new Error('Unable to calculate distance');
    }

    const pricingRules = await this.prisma.pricingRule.findMany({
      where: { isActive: true },
    });

    const baseFare = this.getBaseFare(request.vehicleType, pricingRules);
    const perMileRate = this.getPerMileRate(request.vehicleType, pricingRules);
    const distanceCharge = distance.distanceMiles * perMileRate;

    const pickupTime = new Date(request.pickupDatetime);
    const timeSurchargePercent = this.getTimeSurchargePercent(pickupTime, pricingRules);
    const timeSurcharge = (baseFare + distanceCharge) * (timeSurchargePercent / 100);

    const holidaySurchargePercent = this.getHolidaySurchargePercent(pickupTime, pricingRules);
    const holidaySurcharge = (baseFare + distanceCharge) * (holidaySurchargePercent / 100);

    const meetAndGreetFee = request.meetAndGreet
      ? this.getMeetAndGreetFee(pricingRules)
      : 0;

    const totalPrice = baseFare + distanceCharge + timeSurcharge + holidaySurcharge + meetAndGreetFee;

    return {
      baseFare: this.round(baseFare),
      distanceCharge: this.round(distanceCharge),
      timeSurcharge: this.round(timeSurcharge),
      holidaySurcharge: this.round(holidaySurcharge),
      meetAndGreetFee: this.round(meetAndGreetFee),
      totalPrice: this.round(totalPrice),
      distance,
      breakdown: {
        baseFare: `£${this.round(baseFare).toFixed(2)}`,
        perMileRate: `£${perMileRate.toFixed(2)}/mile`,
        distanceMiles: `${distance.distanceMiles.toFixed(1)} miles`,
        distanceCharge: `£${this.round(distanceCharge).toFixed(2)}`,
        timeSurchargePercent: `${timeSurchargePercent}%`,
        holidaySurchargePercent: `${holidaySurchargePercent}%`,
        meetAndGreetFee: `£${this.round(meetAndGreetFee).toFixed(2)}`,
        returnDiscountPercent: '0%',
        subtotal: `£${this.round(totalPrice).toFixed(2)}`,
        total: `£${this.round(totalPrice).toFixed(2)}`,
      },
    };
  }

  /**
   * Calculate quote for a return journey (outbound + return with discount)
   */
  async calculateReturnJourneyQuote(request: ReturnJourneyQuoteRequest): Promise<ReturnJourneyQuote> {
    // Calculate both legs independently
    const [outboundQuote, returnQuote] = await Promise.all([
      this.calculateSingleJourneyQuote(request.outbound),
      this.calculateSingleJourneyQuote(request.returnJourney),
    ]);

    const pricingRules = await this.prisma.pricingRule.findMany({
      where: { isActive: true },
    });

    const subtotal = outboundQuote.totalPrice + returnQuote.totalPrice;
    const discountPercent = this.getReturnDiscountPercent(pricingRules);
    const discountAmount = this.round(subtotal * (discountPercent / 100));
    const totalPrice = this.round(subtotal - discountAmount);

    return {
      outbound: outboundQuote,
      returnJourney: returnQuote,
      subtotal: this.round(subtotal),
      discountPercent,
      discountAmount,
      totalPrice,
    };
  }
}

