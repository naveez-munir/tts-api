import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateBookingDto, CreateReturnBookingDto } from './dto/create-booking.dto.js';
import type { UpdateBookingDto } from './dto/update-booking.dto.js';
import type { BookingResponse, BookingGroupResponse, CustomerBookingsResponse } from './dto/booking-response.dto.js';
import { Booking, BookingStatus, JourneyType, BookingGroup, DiscountType } from '@prisma/client';
import { Prisma } from '@prisma/client';

// Type for booking with group and linked booking
type BookingWithRelations = Booking & {
  bookingGroup?: BookingGroup | null;
  linkedBooking?: Booking | null;
  pairedBooking?: Booking | null;
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a one-way booking
   */
  async create(customerId: string, createBookingDto: CreateBookingDto): Promise<Booking> {
    const bookingReference = this.generateBookingReference();

    const booking = await this.prisma.booking.create({
      data: {
        bookingReference,
        customerId,
        journeyType: JourneyType.ONE_WAY,
        pickupAddress: createBookingDto.pickupAddress,
        pickupPostcode: createBookingDto.pickupPostcode,
        pickupLat: createBookingDto.pickupLat,
        pickupLng: createBookingDto.pickupLng,
        dropoffAddress: createBookingDto.dropoffAddress,
        dropoffPostcode: createBookingDto.dropoffPostcode,
        dropoffLat: createBookingDto.dropoffLat,
        dropoffLng: createBookingDto.dropoffLng,
        pickupDatetime: new Date(createBookingDto.pickupDatetime),
        passengerCount: createBookingDto.passengerCount,
        luggageCount: createBookingDto.luggageCount,
        vehicleType: createBookingDto.vehicleType,
        serviceType: createBookingDto.serviceType,
        flightNumber: createBookingDto.flightNumber || null,
        specialRequirements: createBookingDto.specialRequirements || null,
        status: BookingStatus.PENDING_PAYMENT,
        customerPrice: new Prisma.Decimal(createBookingDto.customerPrice.toString()),
      },
    });

    return booking;
  }

  /**
   * Create a return journey (BookingGroup with outbound + return bookings)
   */
  async createReturnJourney(
    customerId: string,
    dto: CreateReturnBookingDto,
  ): Promise<{ bookingGroup: BookingGroup; outboundBooking: Booking; returnBooking: Booking }> {
    const groupReference = this.generateGroupReference();
    const outboundReference = this.generateBookingReference();
    const returnReference = this.generateBookingReference();

    // Use transaction to ensure all records are created atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create the booking group
      const bookingGroup = await tx.bookingGroup.create({
        data: {
          groupReference,
          customerId,
          totalPrice: new Prisma.Decimal(dto.totalPrice.toString()),
          discountType: DiscountType.RETURN_JOURNEY,
          discountAmount: dto.discountAmount
            ? new Prisma.Decimal(dto.discountAmount.toString())
            : null,
          status: 'ACTIVE',
        },
      });

      // 2. Create outbound booking
      const outboundBooking = await tx.booking.create({
        data: {
          bookingReference: outboundReference,
          customerId,
          journeyType: JourneyType.OUTBOUND,
          bookingGroupId: bookingGroup.id,
          pickupAddress: dto.outbound.pickupAddress,
          pickupPostcode: dto.outbound.pickupPostcode,
          pickupLat: dto.outbound.pickupLat,
          pickupLng: dto.outbound.pickupLng,
          dropoffAddress: dto.outbound.dropoffAddress,
          dropoffPostcode: dto.outbound.dropoffPostcode,
          dropoffLat: dto.outbound.dropoffLat,
          dropoffLng: dto.outbound.dropoffLng,
          pickupDatetime: new Date(dto.outbound.pickupDatetime),
          passengerCount: dto.outbound.passengerCount,
          luggageCount: dto.outbound.luggageCount,
          vehicleType: dto.outbound.vehicleType,
          serviceType: dto.outbound.serviceType,
          flightNumber: dto.outbound.flightNumber || null,
          specialRequirements: dto.outbound.specialRequirements || null,
          status: BookingStatus.PENDING_PAYMENT,
          customerPrice: new Prisma.Decimal(dto.outbound.customerPrice.toString()),
        },
      });

      // 3. Create return booking (linked to outbound)
      const returnBooking = await tx.booking.create({
        data: {
          bookingReference: returnReference,
          customerId,
          journeyType: JourneyType.RETURN,
          bookingGroupId: bookingGroup.id,
          linkedBookingId: outboundBooking.id, // Link to outbound
          pickupAddress: dto.returnJourney.pickupAddress,
          pickupPostcode: dto.returnJourney.pickupPostcode,
          pickupLat: dto.returnJourney.pickupLat,
          pickupLng: dto.returnJourney.pickupLng,
          dropoffAddress: dto.returnJourney.dropoffAddress,
          dropoffPostcode: dto.returnJourney.dropoffPostcode,
          dropoffLat: dto.returnJourney.dropoffLat,
          dropoffLng: dto.returnJourney.dropoffLng,
          pickupDatetime: new Date(dto.returnJourney.pickupDatetime),
          passengerCount: dto.returnJourney.passengerCount,
          luggageCount: dto.returnJourney.luggageCount,
          vehicleType: dto.returnJourney.vehicleType,
          serviceType: dto.returnJourney.serviceType,
          flightNumber: dto.returnJourney.flightNumber || null,
          specialRequirements: dto.returnJourney.specialRequirements || null,
          status: BookingStatus.PENDING_PAYMENT,
          customerPrice: new Prisma.Decimal(dto.returnJourney.customerPrice.toString()),
        },
      });

      return { bookingGroup, outboundBooking, returnBooking };
    });

    return result;
  }

  async findOne(id: string): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        bookingGroup: true,
        linkedBooking: true,
        pairedBooking: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  async findByReference(bookingReference: string): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingReference },
      include: {
        bookingGroup: true,
        linkedBooking: true,
        pairedBooking: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with reference ${bookingReference} not found`);
    }

    return booking;
  }

  /**
   * Find booking group by ID
   */
  async findBookingGroup(groupId: string): Promise<BookingGroup & { bookings: Booking[] }> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: groupId },
      include: {
        bookings: {
          orderBy: { journeyType: 'asc' }, // OUTBOUND first, then RETURN
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Booking group with ID ${groupId} not found`);
    }

    return group;
  }

  /**
   * Find booking group by reference
   */
  async findBookingGroupByReference(groupReference: string): Promise<BookingGroup & { bookings: Booking[] }> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { groupReference },
      include: {
        bookings: {
          orderBy: { journeyType: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Booking group with reference ${groupReference} not found`);
    }

    return group;
  }

  /**
   * Get all bookings for a customer, organized by one-way and return journeys
   * This is the main method for frontend to display customer bookings
   */
  async findCustomerBookingsOrganized(customerId: string): Promise<CustomerBookingsResponse> {
    // Get all one-way bookings
    const oneWayBookings = await this.prisma.booking.findMany({
      where: {
        customerId,
        journeyType: JourneyType.ONE_WAY,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get all booking groups (return journeys)
    const bookingGroups = await this.prisma.bookingGroup.findMany({
      where: { customerId },
      include: {
        bookings: {
          orderBy: { journeyType: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      oneWayBookings: oneWayBookings.map((b) => this.formatBookingResponse(b)),
      returnJourneys: bookingGroups.map((g) => this.formatBookingGroupResponse(g)),
    };
  }

  /**
   * Legacy method - returns all bookings flat (for backward compatibility)
   */
  async findCustomerBookings(customerId: string): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, updateBookingDto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    // Only allow updates if booking is in PENDING_PAYMENT or PAID status
    const allowedStatuses: BookingStatus[] = [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException('Cannot update booking in current status');
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        pickupDatetime: updateBookingDto.pickupDatetime
          ? new Date(updateBookingDto.pickupDatetime)
          : undefined,
        passengerCount: updateBookingDto.passengerCount,
        luggageCount: updateBookingDto.luggageCount,
        specialRequirements: updateBookingDto.specialRequirements,
      },
    });
  }

  async cancel(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { bookingGroup: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    // Update booking status
    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });

    // If part of a return journey, update group status
    if (booking.bookingGroupId) {
      await this.updateBookingGroupStatus(booking.bookingGroupId);
    }

    return updatedBooking;
  }

  /**
   * Update booking group status based on individual booking statuses
   */
  private async updateBookingGroupStatus(groupId: string): Promise<void> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: groupId },
      include: { bookings: true },
    });

    if (!group) return;

    const statuses = group.bookings.map((b) => b.status);
    const allCancelled = statuses.every((s) => s === BookingStatus.CANCELLED);
    const someCancelled = statuses.some((s) => s === BookingStatus.CANCELLED);
    const allCompleted = statuses.every((s) => s === BookingStatus.COMPLETED);

    let newStatus: 'ACTIVE' | 'PARTIALLY_CANCELLED' | 'FULLY_CANCELLED' | 'COMPLETED' = 'ACTIVE';

    if (allCancelled) {
      newStatus = 'FULLY_CANCELLED';
    } else if (someCancelled) {
      newStatus = 'PARTIALLY_CANCELLED';
    } else if (allCompleted) {
      newStatus = 'COMPLETED';
    }

    await this.prisma.bookingGroup.update({
      where: { id: groupId },
      data: { status: newStatus },
    });
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    const booking = await this.prisma.booking.update({
      where: { id },
      data: { status },
    });

    // Update group status if part of return journey
    if (booking.bookingGroupId) {
      await this.updateBookingGroupStatus(booking.bookingGroupId);
    }

    return booking;
  }

  // =========================================================================
  // RESPONSE FORMATTERS
  // =========================================================================

  formatBookingResponse(booking: Booking): BookingResponse {
    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      journeyType: booking.journeyType,
      status: booking.status,
      pickupAddress: booking.pickupAddress,
      pickupPostcode: booking.pickupPostcode,
      dropoffAddress: booking.dropoffAddress,
      dropoffPostcode: booking.dropoffPostcode,
      pickupDatetime: booking.pickupDatetime.toISOString(),
      passengerCount: booking.passengerCount,
      luggageCount: booking.luggageCount,
      vehicleType: booking.vehicleType,
      serviceType: booking.serviceType,
      flightNumber: booking.flightNumber,
      specialRequirements: booking.specialRequirements,
      customerPrice: Number(booking.customerPrice),
      linkedBookingId: booking.linkedBookingId,
      bookingGroupId: booking.bookingGroupId,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  formatBookingGroupResponse(group: BookingGroup & { bookings: Booking[] }): BookingGroupResponse {
    return {
      id: group.id,
      groupReference: group.groupReference,
      status: group.status,
      totalPrice: Number(group.totalPrice),
      discountType: group.discountType,
      discountAmount: group.discountAmount ? Number(group.discountAmount) : null,
      createdAt: group.createdAt.toISOString(),
      bookings: group.bookings.map((b) => this.formatBookingResponse(b)),
    };
  }

  // =========================================================================
  // REFERENCE GENERATORS
  // =========================================================================

  private generateBookingReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TTS-${timestamp}${random}`;
  }

  private generateGroupReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TTS-GRP-${timestamp}${random}`;
  }
}

