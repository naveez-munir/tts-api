import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { GoogleMapsService, WaypointLocation } from './google-maps.service.js';
import type { DistanceResult } from './google-maps.service.js';
import { VehicleType, ServiceType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SystemSettingsService } from '../../modules/system-settings/system-settings.service.js';

// Stop point for multi-stop journeys
export interface StopPoint {
  address: string;
  lat: number;
  lng: number;
  postcode?: string;
}

// Single journey quote request
export interface SingleJourneyQuoteRequest {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: VehicleType;
  pickupDatetime: string;
  serviceType?: ServiceType;
  meetAndGreet?: boolean;
  childSeats?: number;
  boosterSeats?: number;
  stops?: StopPoint[];
}

// Return journey quote request
export interface ReturnJourneyQuoteRequest {
  outbound: SingleJourneyQuoteRequest;
  returnJourney: SingleJourneyQuoteRequest;
}

export interface AllVehiclesQuoteRequest {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  pickupDatetime: string;
  serviceType?: ServiceType;
  isReturnJourney?: boolean;
  returnDatetime?: string;
  meetAndGreet?: boolean;
  childSeats?: number;
  boosterSeats?: number;
  stops?: StopPoint[];
  passengers: number;
  luggage: number;
}

export interface VehicleQuoteItem {
  vehicleType: string;
  label: string;
  canAccommodate: boolean;
  totalPrice: number;
  baseFare: number;
  distanceCharge: number;
  timeSurcharge: number;
  holidaySurcharge: number;
  meetAndGreetFee: number;
  childSeatsFee: number;
  boosterSeatsFee: number;
  airportFee: number;
  outboundPrice?: number;
  returnPrice?: number;
  discountAmount?: number;
}

export interface AllVehiclesQuoteResponse {
  distance: DistanceResult | null;
  vehicleQuotes: VehicleQuoteItem[];
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
  childSeatsFee: number;
  boosterSeatsFee: number;
  airportFee: number;
  totalPrice: number;
  distance: DistanceResult | null;
  breakdown: QuoteBreakdown;
}

// Return journey quote result (both legs)
export interface ReturnJourneyQuote {
  outbound: SingleJourneyQuote;
  returnJourney: SingleJourneyQuote;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  totalPrice: number;
}

// Legacy response for backward compatibility
export interface QuoteResponse {
  baseFare: number;
  distanceCharge: number;
  timeSurcharge: number;
  holidaySurcharge: number;
  meetAndGreetFee: number;
  childSeatsFee: number;
  boosterSeatsFee: number;
  airportFee: number;
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
  childSeatsFee: string;
  boosterSeatsFee: string;
  airportFee: string;
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
  CHILD_SEAT: 'CHILD_SEAT',
  BOOSTER_SEAT: 'BOOSTER_SEAT',
  AIRPORT_FEE: 'AIRPORT_FEE',
} as const;

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async calculateQuote(request: QuoteRequest): Promise<QuoteResponse> {
    // Get distance from Google Maps - use waypoints if stops are provided
    const waypoints: WaypointLocation[] = (request.stops || []).map(s => ({ lat: s.lat, lng: s.lng }));
    const distance = await this.googleMapsService.calculateDistanceWithWaypoints(
      { lat: request.pickupLat, lng: request.pickupLng },
      { lat: request.dropoffLat, lng: request.dropoffLng },
      waypoints,
    );

    if (!distance) {
      throw new Error('Unable to calculate distance');
    }

    // Get pricing rules from database
    const pricingRules = await this.prisma.pricingRule.findMany({
      where: { isActive: true },
    });

    // Calculate base fare
    const baseFare = await this.getBaseFare(request.vehicleType, pricingRules);

    // Calculate distance charge with tiered pricing
    const { distanceCharge, perMileRate } = await this.calculateTieredDistanceCharge(
      request.vehicleType,
      distance.distanceMiles,
      pricingRules,
    );

    // Calculate time-based surcharges
    const pickupTime = new Date(request.pickupDatetime);
    const timeSurchargePercent = await this.getTimeSurchargePercent(pickupTime, pricingRules);
    const timeSurcharge = (baseFare + distanceCharge) * (timeSurchargePercent / 100);

    // Calculate holiday surcharge
    const holidaySurchargePercent = await this.getHolidaySurchargePercent(pickupTime, pricingRules);
    const holidaySurcharge = (baseFare + distanceCharge) * (holidaySurchargePercent / 100);

    // Meet and greet fee
    const meetAndGreetFee = request.meetAndGreet
      ? await this.getMeetAndGreetFee(pricingRules)
      : 0;

    // Child seats fee (per seat)
    const childSeatUnitFee = await this.getChildSeatFee(pricingRules);
    const childSeatsFee = (request.childSeats ?? 0) * childSeatUnitFee;

    // Booster seats fee (per seat)
    const boosterSeatUnitFee = await this.getBoosterSeatFee(pricingRules);
    const boosterSeatsFee = (request.boosterSeats ?? 0) * boosterSeatUnitFee;

    // Airport fee
    const airportFee = await this.getAirportFee(request.serviceType, pricingRules);

    // Calculate subtotal (including all service fees)
    let subtotal = baseFare + distanceCharge + timeSurcharge + holidaySurcharge
      + meetAndGreetFee + childSeatsFee + boosterSeatsFee + airportFee;

    // Return journey discount
    let returnDiscount = 0;
    const returnDiscountPercent = request.isReturnJourney
      ? await this.getReturnDiscountPercent(pricingRules)
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
      childSeatsFee: this.round(childSeatsFee),
      boosterSeatsFee: this.round(boosterSeatsFee),
      airportFee: this.round(airportFee),
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
        childSeatsFee: `£${this.round(childSeatsFee).toFixed(2)}`,
        boosterSeatsFee: `£${this.round(boosterSeatsFee).toFixed(2)}`,
        airportFee: `£${this.round(airportFee).toFixed(2)}`,
        returnDiscountPercent: `${returnDiscountPercent}%`,
        subtotal: `£${this.round(subtotal).toFixed(2)}`,
        total: `£${this.round(totalPrice).toFixed(2)}`,
      },
    };
  }

  private async getBaseFare(
    vehicleType: VehicleType,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    const rule = rules.find(
      (r) => r.ruleType === RULE_TYPES.BASE_FARE && r.vehicleType === vehicleType,
    );

    if (rule) {
      return Number(rule.baseValue);
    }

    // Fallback to SystemSettings
    const settingKey = `BASE_FARE_${vehicleType}`;
    return await this.systemSettingsService.getSettingOrDefault(settingKey, 15);
  }

  private async getPerMileRate(
    vehicleType: VehicleType,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    const rule = rules.find(
      (r) => r.ruleType === RULE_TYPES.PER_MILE_RATE && r.vehicleType === vehicleType,
    );

    if (rule) {
      return Number(rule.baseValue);
    }

    // Fallback to SystemSettings
    const settingKey = `PER_MILE_${vehicleType}`;
    return await this.systemSettingsService.getSettingOrDefault(settingKey, 2.5);
  }

  /**
   * Calculate distance charge with tiered pricing
   * Rate reduces by rateReductionPer100Miles for each 100-mile bracket
   */
  private async calculateTieredDistanceCharge(
    vehicleType: VehicleType,
    distanceMiles: number,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<{ distanceCharge: number; perMileRate: number }> {
    let basePerMileRate = await this.getPerMileRate(vehicleType, rules);

    const minimumMilesThreshold = await this.systemSettingsService.getSettingOrDefault('MINIMUM_MILES_THRESHOLD', 40);
    const shortDistanceMultiplier = await this.systemSettingsService.getSettingOrDefault('SHORT_DISTANCE_MULTIPLIER', 1);

    if (distanceMiles < minimumMilesThreshold && shortDistanceMultiplier > 1) {
      basePerMileRate = basePerMileRate * shortDistanceMultiplier;
    }

    const vehicleCapacity = await this.prisma.vehicleCapacity.findUnique({
      where: { vehicleType },
    });

    const rateReduction = vehicleCapacity?.rateReductionPer100Miles
      ? Number(vehicleCapacity.rateReductionPer100Miles)
      : 0;

    // If no rate reduction, use simple calculation
    if (rateReduction === 0) {
      return {
        distanceCharge: distanceMiles * basePerMileRate,
        perMileRate: basePerMileRate,
      };
    }

    // Calculate tiered distance charge
    let totalCharge = 0;
    let remainingMiles = distanceMiles;
    let currentRate = basePerMileRate;
    let tierCount = 0;

    while (remainingMiles > 0) {
      const milesInThisTier = Math.min(remainingMiles, 100);
      totalCharge += milesInThisTier * currentRate;
      remainingMiles -= milesInThisTier;
      tierCount++;

      // Reduce rate for next tier (minimum rate is 0.01)
      currentRate = Math.max(0.01, currentRate - rateReduction);
    }

    // Calculate effective per-mile rate for display
    const effectivePerMileRate = distanceMiles > 0 ? totalCharge / distanceMiles : basePerMileRate;

    return {
      distanceCharge: totalCharge,
      perMileRate: effectivePerMileRate,
    };
  }

  private async getTimeSurchargePercent(
    pickupTime: Date,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    const hour = pickupTime.getHours();

    // Night surcharge: Get hours from SystemSettings
    const nightStart = await this.systemSettingsService.getSettingOrDefault('NIGHT_HOURS_START', 22);
    const nightEnd = await this.systemSettingsService.getSettingOrDefault('NIGHT_HOURS_END', 6);

    if (hour >= nightStart || hour < nightEnd) {
      const rule = rules.find((r) => r.ruleType === RULE_TYPES.NIGHT_SURCHARGE);
      if (rule) {
        return Number(rule.baseValue);
      }
      return await this.systemSettingsService.getSettingOrDefault('NIGHT_SURCHARGE_PERCENT', 25);
    }

    // Peak surcharge: Get hours from SystemSettings
    const peakMorningStart = await this.systemSettingsService.getSettingOrDefault('PEAK_MORNING_START', 7);
    const peakMorningEnd = await this.systemSettingsService.getSettingOrDefault('PEAK_MORNING_END', 9);
    const peakEveningStart = await this.systemSettingsService.getSettingOrDefault('PEAK_EVENING_START', 17);
    const peakEveningEnd = await this.systemSettingsService.getSettingOrDefault('PEAK_EVENING_END', 19);
    const peakWeekdaysOnly = await this.systemSettingsService.getSettingOrDefault('PEAK_WEEKDAYS_ONLY', true);

    const dayOfWeek = pickupTime.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isPeakHour = (hour >= peakMorningStart && hour < peakMorningEnd) ||
                       (hour >= peakEveningStart && hour < peakEveningEnd);

    if ((!peakWeekdaysOnly || isWeekday) && isPeakHour) {
      const rule = rules.find((r) => r.ruleType === RULE_TYPES.PEAK_SURCHARGE);
      if (rule) {
        return Number(rule.baseValue);
      }
      return await this.systemSettingsService.getSettingOrDefault('PEAK_SURCHARGE_PERCENT', 10);
    }

    return 0;
  }

  private async getHolidaySurchargePercent(
    pickupTime: Date,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    const month = pickupTime.getMonth();
    const day = pickupTime.getDate();

    // Get holiday dates from SystemSettings (format: MM-DD)
    const christmasStart = await this.systemSettingsService.getSettingOrDefault('CHRISTMAS_START', '12-24');
    const christmasEnd = await this.systemSettingsService.getSettingOrDefault('CHRISTMAS_END', '12-26');
    const newYearEve = await this.systemSettingsService.getSettingOrDefault('NEW_YEAR_EVE', '12-31');
    const newYearDay = await this.systemSettingsService.getSettingOrDefault('NEW_YEAR_DAY', '01-01');

    const currentDate = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Check if current date falls within Christmas period
    const isChristmas = currentDate >= christmasStart && currentDate <= christmasEnd;

    const isNewYear = currentDate === newYearEve || currentDate === newYearDay;

    if (isChristmas || isNewYear) {
      const rule = rules.find((r) => r.ruleType === RULE_TYPES.HOLIDAY_SURCHARGE);
      if (rule) {
        return Number(rule.baseValue);
      }
      return await this.systemSettingsService.getSettingOrDefault('HOLIDAY_SURCHARGE_PERCENT', 50);
    }

    return 0;
  }

  private async getMeetAndGreetFee(
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    const rule = rules.find((r) => r.ruleType === RULE_TYPES.MEET_AND_GREET);
    if (rule) {
      return Number(rule.baseValue);
    }
    return await this.systemSettingsService.getSettingOrDefault('MEET_AND_GREET_FEE', 10);
  }

  private async getReturnDiscountPercent(
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    const rule = rules.find((r) => r.ruleType === RULE_TYPES.RETURN_DISCOUNT);
    if (rule) {
      return Number(rule.baseValue);
    }
    return await this.systemSettingsService.getSettingOrDefault('RETURN_DISCOUNT_PERCENT', 5);
  }

  /**
   * Get child seat fee per seat
   * Priority: PricingRule > SystemSettings > default
   */
  private async getChildSeatFee(
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    const rule = rules.find((r) => r.ruleType === RULE_TYPES.CHILD_SEAT);
    if (rule) {
      return Number(rule.baseValue);
    }
    return await this.systemSettingsService.getSettingOrDefault('CHILD_SEAT_FEE', 10);
  }

  /**
   * Get booster seat fee per seat
   * Priority: PricingRule > SystemSettings > default
   */
  private async getBoosterSeatFee(
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    const rule = rules.find((r) => r.ruleType === RULE_TYPES.BOOSTER_SEAT);
    if (rule) {
      return Number(rule.baseValue);
    }
    return await this.systemSettingsService.getSettingOrDefault('BOOSTER_SEAT_FEE', 5);
  }

  private async getAirportFee(
    serviceType: ServiceType | undefined,
    rules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<number> {
    if (!serviceType || serviceType === ServiceType.POINT_TO_POINT) {
      return 0;
    }
    const rule = rules.find((r) => r.ruleType === RULE_TYPES.AIRPORT_FEE);
    if (rule) {
      return Number(rule.baseValue);
    }
    return await this.systemSettingsService.getSettingOrDefault('AIRPORT_FEE', 5);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate quote for a single journey (one-way)
   */
  async calculateSingleJourneyQuote(request: SingleJourneyQuoteRequest): Promise<SingleJourneyQuote> {
    // Get distance using waypoints if stops are provided
    const waypoints: WaypointLocation[] = (request.stops || []).map(s => ({ lat: s.lat, lng: s.lng }));
    const distance = await this.googleMapsService.calculateDistanceWithWaypoints(
      { lat: request.pickupLat, lng: request.pickupLng },
      { lat: request.dropoffLat, lng: request.dropoffLng },
      waypoints,
    );

    if (!distance) {
      throw new Error('Unable to calculate distance');
    }

    const pricingRules = await this.prisma.pricingRule.findMany({
      where: { isActive: true },
    });

    const baseFare = await this.getBaseFare(request.vehicleType, pricingRules);
    const { distanceCharge, perMileRate } = await this.calculateTieredDistanceCharge(
      request.vehicleType,
      distance.distanceMiles,
      pricingRules,
    );

    const pickupTime = new Date(request.pickupDatetime);
    const timeSurchargePercent = await this.getTimeSurchargePercent(pickupTime, pricingRules);
    const timeSurcharge = (baseFare + distanceCharge) * (timeSurchargePercent / 100);

    const holidaySurchargePercent = await this.getHolidaySurchargePercent(pickupTime, pricingRules);
    const holidaySurcharge = (baseFare + distanceCharge) * (holidaySurchargePercent / 100);

    const meetAndGreetFee = request.meetAndGreet
      ? await this.getMeetAndGreetFee(pricingRules)
      : 0;

    // Child seats fee (per seat)
    const childSeatUnitFee = await this.getChildSeatFee(pricingRules);
    const childSeatsFee = (request.childSeats ?? 0) * childSeatUnitFee;

    // Booster seats fee (per seat)
    const boosterSeatUnitFee = await this.getBoosterSeatFee(pricingRules);
    const boosterSeatsFee = (request.boosterSeats ?? 0) * boosterSeatUnitFee;

    // Airport fee
    const airportFee = await this.getAirportFee(request.serviceType, pricingRules);

    const totalPrice = baseFare + distanceCharge + timeSurcharge + holidaySurcharge
      + meetAndGreetFee + childSeatsFee + boosterSeatsFee + airportFee;

    return {
      baseFare: this.round(baseFare),
      distanceCharge: this.round(distanceCharge),
      timeSurcharge: this.round(timeSurcharge),
      holidaySurcharge: this.round(holidaySurcharge),
      meetAndGreetFee: this.round(meetAndGreetFee),
      childSeatsFee: this.round(childSeatsFee),
      boosterSeatsFee: this.round(boosterSeatsFee),
      airportFee: this.round(airportFee),
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
        childSeatsFee: `£${this.round(childSeatsFee).toFixed(2)}`,
        boosterSeatsFee: `£${this.round(boosterSeatsFee).toFixed(2)}`,
        airportFee: `£${this.round(airportFee).toFixed(2)}`,
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
    const [outboundQuote, returnQuote] = await Promise.all([
      this.calculateSingleJourneyQuote(request.outbound),
      this.calculateSingleJourneyQuote(request.returnJourney),
    ]);

    const pricingRules = await this.prisma.pricingRule.findMany({
      where: { isActive: true },
    });

    const subtotal = outboundQuote.totalPrice + returnQuote.totalPrice;
    const discountPercent = await this.getReturnDiscountPercent(pricingRules);
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

  async calculateAllVehiclesQuote(request: AllVehiclesQuoteRequest): Promise<AllVehiclesQuoteResponse> {
    // Get distance using waypoints if stops are provided
    const waypoints: WaypointLocation[] = (request.stops || []).map(s => ({ lat: s.lat, lng: s.lng }));
    const distance = await this.googleMapsService.calculateDistanceWithWaypoints(
      { lat: request.pickupLat, lng: request.pickupLng },
      { lat: request.dropoffLat, lng: request.dropoffLng },
      waypoints,
    );

    if (!distance) {
      throw new Error('Unable to calculate distance');
    }

    const vehicleCapacities = await this.prisma.vehicleCapacity.findMany({
      where: { isActive: true },
      orderBy: { vehicleType: 'asc' },
    });

    const pricingRules = await this.prisma.pricingRule.findMany({
      where: { isActive: true },
    });

    const vehicleQuotes = await Promise.all(
      vehicleCapacities.map(async (vehicle) => {
        const canAccommodate =
          request.passengers <= vehicle.maxPassengers &&
          request.luggage <= vehicle.maxSuitcases;

        if (!canAccommodate) {
          return null;
        }

        if (request.isReturnJourney && request.returnDatetime) {
          const outboundQuote = await this.calculateSingleQuoteWithDistance({
            vehicleType: vehicle.vehicleType,
            pickupDatetime: request.pickupDatetime,
            serviceType: request.serviceType,
            meetAndGreet: request.meetAndGreet,
            childSeats: request.childSeats,
            boosterSeats: request.boosterSeats,
          }, distance, pricingRules);

          const returnQuote = await this.calculateSingleQuoteWithDistance({
            vehicleType: vehicle.vehicleType,
            pickupDatetime: request.returnDatetime,
            serviceType: request.serviceType,
            meetAndGreet: false,
            childSeats: request.childSeats,
            boosterSeats: request.boosterSeats,
          }, distance, pricingRules);

          const subtotal = outboundQuote.totalPrice + returnQuote.totalPrice;
          const discountPercent = await this.getReturnDiscountPercent(pricingRules);
          const discountAmount = this.round(subtotal * (discountPercent / 100));
          const totalPrice = this.round(subtotal - discountAmount);

          return {
            vehicleType: vehicle.vehicleType,
            label: this.getVehicleLabel(vehicle.vehicleType),
            canAccommodate: true,
            totalPrice,
            baseFare: outboundQuote.baseFare + returnQuote.baseFare,
            distanceCharge: outboundQuote.distanceCharge + returnQuote.distanceCharge,
            timeSurcharge: outboundQuote.timeSurcharge + returnQuote.timeSurcharge,
            holidaySurcharge: outboundQuote.holidaySurcharge + returnQuote.holidaySurcharge,
            meetAndGreetFee: outboundQuote.meetAndGreetFee + returnQuote.meetAndGreetFee,
            childSeatsFee: outboundQuote.childSeatsFee + returnQuote.childSeatsFee,
            boosterSeatsFee: outboundQuote.boosterSeatsFee + returnQuote.boosterSeatsFee,
            airportFee: outboundQuote.airportFee + returnQuote.airportFee,
            outboundPrice: outboundQuote.totalPrice,
            returnPrice: returnQuote.totalPrice,
            discountAmount,
          };
        } else {
          const quote = await this.calculateSingleQuoteWithDistance({
            vehicleType: vehicle.vehicleType,
            pickupDatetime: request.pickupDatetime,
            serviceType: request.serviceType,
            meetAndGreet: request.meetAndGreet,
            childSeats: request.childSeats,
            boosterSeats: request.boosterSeats,
          }, distance, pricingRules);

          return {
            vehicleType: vehicle.vehicleType,
            label: this.getVehicleLabel(vehicle.vehicleType),
            canAccommodate: true,
            totalPrice: quote.totalPrice,
            baseFare: quote.baseFare,
            distanceCharge: quote.distanceCharge,
            timeSurcharge: quote.timeSurcharge,
            holidaySurcharge: quote.holidaySurcharge,
            meetAndGreetFee: quote.meetAndGreetFee,
            childSeatsFee: quote.childSeatsFee,
            boosterSeatsFee: quote.boosterSeatsFee,
            airportFee: quote.airportFee,
          };
        }
      })
    );

    return {
      distance,
      vehicleQuotes: vehicleQuotes.filter((q) => q !== null) as VehicleQuoteItem[],
    };
  }

  private async calculateSingleQuoteWithDistance(
    options: {
      vehicleType: VehicleType;
      pickupDatetime: string;
      serviceType?: ServiceType;
      meetAndGreet?: boolean;
      childSeats?: number;
      boosterSeats?: number;
    },
    distance: DistanceResult,
    pricingRules: { ruleType: string; vehicleType: VehicleType | null; baseValue: Decimal }[],
  ): Promise<Omit<SingleJourneyQuote, 'distance' | 'breakdown'>> {
    const baseFare = await this.getBaseFare(options.vehicleType, pricingRules);
    const { distanceCharge } = await this.calculateTieredDistanceCharge(
      options.vehicleType,
      distance.distanceMiles,
      pricingRules,
    );

    const pickupTime = new Date(options.pickupDatetime);
    const timeSurchargePercent = await this.getTimeSurchargePercent(pickupTime, pricingRules);
    const timeSurcharge = (baseFare + distanceCharge) * (timeSurchargePercent / 100);

    const holidaySurchargePercent = await this.getHolidaySurchargePercent(pickupTime, pricingRules);
    const holidaySurcharge = (baseFare + distanceCharge) * (holidaySurchargePercent / 100);

    const meetAndGreetFee = options.meetAndGreet
      ? await this.getMeetAndGreetFee(pricingRules)
      : 0;

    const childSeatUnitFee = await this.getChildSeatFee(pricingRules);
    const childSeatsFee = (options.childSeats ?? 0) * childSeatUnitFee;

    const boosterSeatUnitFee = await this.getBoosterSeatFee(pricingRules);
    const boosterSeatsFee = (options.boosterSeats ?? 0) * boosterSeatUnitFee;

    const airportFee = await this.getAirportFee(options.serviceType, pricingRules);

    const totalPrice = baseFare + distanceCharge + timeSurcharge + holidaySurcharge
      + meetAndGreetFee + childSeatsFee + boosterSeatsFee + airportFee;

    return {
      baseFare: this.round(baseFare),
      distanceCharge: this.round(distanceCharge),
      timeSurcharge: this.round(timeSurcharge),
      holidaySurcharge: this.round(holidaySurcharge),
      meetAndGreetFee: this.round(meetAndGreetFee),
      childSeatsFee: this.round(childSeatsFee),
      boosterSeatsFee: this.round(boosterSeatsFee),
      airportFee: this.round(airportFee),
      totalPrice: this.round(totalPrice),
    };
  }

  private getVehicleLabel(vehicleType: string): string {
    const labels: Record<string, string> = {
      SALOON: 'Saloon',
      ESTATE: 'Estate',
      GREEN_CAR: 'Green Car (Electric)',
      MPV: 'People Carrier',
      EXECUTIVE: 'Executive',
      EXECUTIVE_LUXURY: 'Executive Luxury',
      EXECUTIVE_PEOPLE_CARRIER: 'Executive People Carrier',
      MINIBUS: '8-Seater Minibus',
    };
    return labels[vehicleType] || vehicleType;
  }
}

