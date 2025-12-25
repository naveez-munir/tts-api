import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookingsService } from './bookings.service';
import { QuoteRequestDto, CreateBookingDto, UpdateBookingDto } from './dto';
import { BookingStatus } from '../common/enums';

@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  /**
   * Calculate quote for a journey (no authentication required)
   */
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  async getQuote(@Body() dto: QuoteRequestDto) {
    const quote = await this.bookingsService.getQuote(dto);
    return {
      success: true,
      data: quote,
    };
  }

  /**
   * Create a new booking (authentication required)
   */
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() dto: CreateBookingDto, @Request() req) {
    const result = await this.bookingsService.create(dto, req.user.id);
    return {
      success: true,
      data: {
        booking: {
          id: result.booking.id,
          bookingReference: result.booking.bookingReference,
          status: result.booking.status,
          quotedPrice: result.booking.quotedPrice,
          pickupAddress: result.booking.pickupAddress,
          dropoffAddress: result.booking.dropoffAddress,
          pickupDatetime: result.booking.pickupDatetime,
          vehicleType: result.booking.vehicleType,
          passengerCount: result.booking.passengerCount,
          luggageCount: result.booking.luggageCount,
        },
        paymentIntent: result.paymentIntent,
      },
    };
  }

  /**
   * Get all bookings for authenticated user
   */
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(
    @Request() req,
    @Query('status') status?: BookingStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.bookingsService.findAll(req.user.id, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return {
      success: true,
      data: {
        bookings: result.bookings.map((booking) => ({
          id: booking.id,
          bookingReference: booking.bookingReference,
          status: booking.status,
          pickupAddress: booking.pickupAddress,
          dropoffAddress: booking.dropoffAddress,
          pickupDatetime: booking.pickupDatetime,
          quotedPrice: booking.quotedPrice,
          vehicleType: booking.vehicleType,
          passengerCount: booking.passengerCount,
          luggageCount: booking.luggageCount,
          createdAt: booking.createdAt,
        })),
      },
      meta: result.meta,
    };
  }

  /**
   * Get booking by ID
   */
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const booking = await this.bookingsService.findOne(id, req.user.id);
    return {
      success: true,
      data: {
        id: booking.id,
        bookingReference: booking.bookingReference,
        status: booking.status,
        serviceType: booking.serviceType,
        pickupAddress: booking.pickupAddress,
        pickupPostcode: booking.pickupPostcode,
        dropoffAddress: booking.dropoffAddress,
        dropoffPostcode: booking.dropoffPostcode,
        pickupDatetime: booking.pickupDatetime,
        passengerCount: booking.passengerCount,
        luggageCount: booking.luggageCount,
        vehicleType: booking.vehicleType,
        flightNumber: booking.flightNumber,
        terminal: booking.terminal,
        hasMeetAndGreet: booking.hasMeetAndGreet,
        specialRequirements: booking.specialRequirements,
        viaPoints: booking.viaPoints,
        distanceMiles: booking.distanceMiles,
        durationMinutes: booking.durationMinutes,
        quotedPrice: booking.quotedPrice,
        isReturnJourney: booking.isReturnJourney,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        transactions: booking.transactions?.map((t) => ({
          type: t.type,
          amount: t.amount,
          status: t.status,
          createdAt: t.createdAt,
        })),
      },
    };
  }

  /**
   * Update booking (limited fields, only before assignment)
   */
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
    @Request() req,
  ) {
    const booking = await this.bookingsService.update(id, dto, req.user.id);
    return {
      success: true,
      data: {
        id: booking.id,
        bookingReference: booking.bookingReference,
        status: booking.status,
        pickupDatetime: booking.pickupDatetime,
        passengerCount: booking.passengerCount,
        luggageCount: booking.luggageCount,
        specialRequirements: booking.specialRequirements,
        updatedAt: booking.updatedAt,
      },
    };
  }

  /**
   * Cancel booking
   */
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const result = await this.bookingsService.cancel(id, req.user.id);
    return {
      success: true,
      data: {
        booking: {
          id: result.booking.id,
          status: result.booking.status,
          cancelledAt: result.booking.cancelledAt,
        },
        refund: result.refund,
      },
    };
  }
}
