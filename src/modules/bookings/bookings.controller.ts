import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingSchema, CreateReturnBookingSchema } from './dto/create-booking.dto.js';
import type { CreateBookingDto, CreateReturnBookingDto } from './dto/create-booking.dto.js';
import { UpdateBookingSchema } from './dto/update-booking.dto.js';
import type { UpdateBookingDto } from './dto/update-booking.dto.js';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /bookings
   * Create a one-way booking
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(CreateBookingSchema)) createBookingDto: CreateBookingDto,
  ) {
    const booking = await this.bookingsService.create(user.id, createBookingDto);
    return {
      success: true,
      data: {
        isReturnJourney: false,
        booking: this.bookingsService.formatBookingResponse(booking),
      },
    };
  }

  /**
   * POST /bookings/return
   * Create a return journey (outbound + return with discount)
   */
  @Post('return')
  @HttpCode(HttpStatus.CREATED)
  async createReturnJourney(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(CreateReturnBookingSchema)) dto: CreateReturnBookingDto,
  ) {
    const result = await this.bookingsService.createReturnJourney(user.id, dto);

    // Fetch the full group with bookings for response
    const bookingGroup = await this.bookingsService.findBookingGroup(result.bookingGroup.id);

    return {
      success: true,
      data: {
        isReturnJourney: true,
        bookingGroup: this.bookingsService.formatBookingGroupResponse(bookingGroup),
      },
    };
  }

  /**
   * GET /bookings/organized
   * Get customer bookings organized by one-way and return journeys
   * This is the primary endpoint for frontend to display bookings
   */
  @Get('organized')
  async findCustomerBookingsOrganized(@CurrentUser() user: { id: string }) {
    const result = await this.bookingsService.findCustomerBookingsOrganized(user.id);
    return {
      success: true,
      data: result,
      meta: {
        oneWayCount: result.oneWayBookings.length,
        returnJourneyCount: result.returnJourneys.length,
        totalBookings: result.oneWayBookings.length + result.returnJourneys.length * 2,
      },
    };
  }

  /**
   * GET /bookings/groups/:groupId
   * Get a booking group by ID (for return journeys)
   */
  @Get('groups/:groupId')
  async findBookingGroup(@Param('groupId') groupId: string) {
    const group = await this.bookingsService.findBookingGroup(groupId);
    return {
      success: true,
      data: this.bookingsService.formatBookingGroupResponse(group),
    };
  }

  /**
   * GET /bookings/groups/reference/:groupReference
   * Get a booking group by reference (e.g., TTS-GRP-XXXXX)
   */
  @Get('groups/reference/:groupReference')
  async findBookingGroupByReference(@Param('groupReference') groupReference: string) {
    const group = await this.bookingsService.findBookingGroupByReference(groupReference);
    return {
      success: true,
      data: this.bookingsService.formatBookingGroupResponse(group),
    };
  }

  /**
   * GET /bookings/:id
   * Get a single booking by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const booking = await this.bookingsService.findOne(id);
    return {
      success: true,
      data: this.bookingsService.formatBookingResponse(booking),
    };
  }

  /**
   * GET /bookings/reference/:bookingReference
   * Get a single booking by reference (e.g., TTS-XXXXX)
   */
  @Get('reference/:bookingReference')
  async findByReference(@Param('bookingReference') bookingReference: string) {
    const booking = await this.bookingsService.findByReference(bookingReference);
    return {
      success: true,
      data: this.bookingsService.formatBookingResponse(booking),
    };
  }

  /**
   * GET /bookings
   * Get all customer bookings (flat list - legacy)
   */
  @Get()
  async findCustomerBookings(@CurrentUser() user: { id: string }) {
    const bookings = await this.bookingsService.findCustomerBookings(user.id);
    return {
      success: true,
      data: bookings.map((b) => this.bookingsService.formatBookingResponse(b)),
      meta: {
        total: bookings.length,
      },
    };
  }

  /**
   * PATCH /bookings/:id
   * Update a booking
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBookingSchema)) updateBookingDto: UpdateBookingDto,
  ) {
    const booking = await this.bookingsService.update(id, updateBookingDto);
    return {
      success: true,
      data: this.bookingsService.formatBookingResponse(booking),
    };
  }

  /**
   * POST /bookings/:id/cancel
   * Cancel a booking
   */
  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    const booking = await this.bookingsService.cancel(id);
    return {
      success: true,
      data: this.bookingsService.formatBookingResponse(booking),
      message: 'Booking cancelled successfully',
    };
  }
}

