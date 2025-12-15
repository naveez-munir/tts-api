import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { GoogleMapsService } from './google-maps.service.js';
import { QuoteService } from './quote.service.js';
import type { PlacePrediction, GeocodingResult, DistanceResult } from './google-maps.service.js';
import type {
  QuoteRequest,
  QuoteResponse,
  SingleJourneyQuoteRequest,
  SingleJourneyQuote,
  ReturnJourneyQuoteRequest,
  ReturnJourneyQuote,
} from './quote.service.js';

@Controller('api/maps')
export class GoogleMapsController {
  constructor(
    private readonly googleMapsService: GoogleMapsService,
    private readonly quoteService: QuoteService,
  ) {}

  /**
   * GET /api/maps/autocomplete?input=London&sessionToken=xxx
   * Get address autocomplete suggestions
   */
  @Get('autocomplete')
  async autocomplete(
    @Query('input') input: string,
    @Query('sessionToken') sessionToken?: string,
  ): Promise<{ success: boolean; data: PlacePrediction[] }> {
    if (!input || input.length < 3) {
      throw new BadRequestException('Input must be at least 3 characters');
    }

    const predictions = await this.googleMapsService.getPlaceAutocomplete(
      input,
      sessionToken,
    );

    return {
      success: true,
      data: predictions,
    };
  }

  /**
   * GET /api/maps/place-details?placeId=xxx
   * Get geocoding details for a place
   */
  @Get('place-details')
  async placeDetails(
    @Query('placeId') placeId: string,
  ): Promise<{ success: boolean; data: GeocodingResult | null }> {
    if (!placeId) {
      throw new BadRequestException('placeId is required');
    }

    const details = await this.googleMapsService.getPlaceDetails(placeId);

    return {
      success: true,
      data: details,
    };
  }

  /**
   * GET /api/maps/distance?originLat=51.5&originLng=-0.1&destLat=51.4&destLng=-0.5
   * Calculate distance and duration between two points
   */
  @Get('distance')
  async distance(
    @Query('originLat') originLat: string,
    @Query('originLng') originLng: string,
    @Query('destLat') destLat: string,
    @Query('destLng') destLng: string,
  ): Promise<{ success: boolean; data: DistanceResult | null }> {
    const oLat = parseFloat(originLat);
    const oLng = parseFloat(originLng);
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);

    if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
      throw new BadRequestException('Invalid coordinates provided');
    }

    const result = await this.googleMapsService.calculateDistance(
      oLat,
      oLng,
      dLat,
      dLng,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /api/maps/quote
   * Calculate a price quote for a journey (legacy - backward compatible)
   */
  @Post('quote')
  async calculateQuote(
    @Body() quoteRequest: QuoteRequest,
  ): Promise<{ success: boolean; data: QuoteResponse }> {
    if (
      !quoteRequest.pickupLat ||
      !quoteRequest.pickupLng ||
      !quoteRequest.dropoffLat ||
      !quoteRequest.dropoffLng
    ) {
      throw new BadRequestException('Pickup and dropoff coordinates are required');
    }

    if (!quoteRequest.vehicleType) {
      throw new BadRequestException('Vehicle type is required');
    }

    if (!quoteRequest.pickupDatetime) {
      throw new BadRequestException('Pickup datetime is required');
    }

    const quote = await this.quoteService.calculateQuote(quoteRequest);

    return {
      success: true,
      data: quote,
    };
  }

  /**
   * POST /api/maps/quote/single
   * Calculate a price quote for a single (one-way) journey
   */
  @Post('quote/single')
  async calculateSingleQuote(
    @Body() request: SingleJourneyQuoteRequest,
  ): Promise<{ success: boolean; data: SingleJourneyQuote }> {
    this.validateSingleJourneyRequest(request);

    const quote = await this.quoteService.calculateSingleJourneyQuote(request);

    return {
      success: true,
      data: quote,
    };
  }

  /**
   * POST /api/maps/quote/return
   * Calculate a price quote for a return journey (outbound + return with discount)
   */
  @Post('quote/return')
  async calculateReturnQuote(
    @Body() request: ReturnJourneyQuoteRequest,
  ): Promise<{ success: boolean; data: ReturnJourneyQuote }> {
    if (!request.outbound || !request.returnJourney) {
      throw new BadRequestException('Both outbound and returnJourney details are required');
    }

    this.validateSingleJourneyRequest(request.outbound, 'outbound');
    this.validateSingleJourneyRequest(request.returnJourney, 'returnJourney');

    const quote = await this.quoteService.calculateReturnJourneyQuote(request);

    return {
      success: true,
      data: quote,
    };
  }

  private validateSingleJourneyRequest(request: SingleJourneyQuoteRequest, prefix = ''): void {
    const fieldPrefix = prefix ? `${prefix}.` : '';

    if (!request.pickupLat || !request.pickupLng) {
      throw new BadRequestException(`${fieldPrefix}pickupLat and ${fieldPrefix}pickupLng are required`);
    }

    if (!request.dropoffLat || !request.dropoffLng) {
      throw new BadRequestException(`${fieldPrefix}dropoffLat and ${fieldPrefix}dropoffLng are required`);
    }

    if (!request.vehicleType) {
      throw new BadRequestException(`${fieldPrefix}vehicleType is required`);
    }

    if (!request.pickupDatetime) {
      throw new BadRequestException(`${fieldPrefix}pickupDatetime is required`);
    }
  }
}

