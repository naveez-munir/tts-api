import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { VehicleCapacityService } from '../vehicle-capacity/vehicle-capacity.service.js';
import { SystemSettingsService } from '../system-settings/system-settings.service.js';
import { QuoteService } from '../../integrations/google-maps/quote.service.js';
import { StripeService } from '../../integrations/stripe/stripe.service.js';
import { NotificationsService } from '../../integrations/notifications/notifications.service.js';
import type { CreateBookingDto, CreateReturnBookingDto, StopDto } from './dto/create-booking.dto.js';
import type { UpdateBookingDto } from './dto/update-booking.dto.js';
import type { BookingResponse, BookingGroupResponse, CustomerBookingsResponse } from './dto/booking-response.dto.js';
import { Booking, BookingStatus, JourneyType, BookingGroup, DiscountType, VehicleType, JobStatus, TransactionType, BidStatus, BookingStop } from '@prisma/client';
import { Prisma } from '@prisma/client';

// Type for assigned operator info
type AssignedOperatorInfo = {
  id: string;
  companyName: string;
  emergencyContactPhone: string | null;
};

// Type for driver details info
type DriverDetailsInfo = {
  id: string;
  driverName: string;
  driverPhone: string;
  vehicleRegistration: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  taxiLicenceNumber: string | null;
  issuingCouncil: string | null;
};

// Type for job with operator and driver details
type JobWithDetails = {
  id: string;
  status: string;
  assignedOperator: AssignedOperatorInfo | null;
  driverDetails: DriverDetailsInfo | null;
};

// Type for booking with group, linked booking, and stops
type BookingWithRelations = Booking & {
  bookingGroup?: BookingGroup | null;
  linkedBooking?: Booking | null;
  pairedBooking?: Booking | null;
  customer?: { id: string; firstName: string; lastName: string; email: string; phoneNumber: string | null } | null;
  stops?: BookingStop[];
  job?: JobWithDetails | null;
};

// Time window for duplicate detection (in minutes)
const DUPLICATE_DETECTION_WINDOW_MINUTES = 5;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicleCapacityService: VehicleCapacityService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly quoteService: QuoteService,
    private readonly stripeService: StripeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a one-way booking
   * Returns existing booking if duplicate detected (idempotent)
   */
  async create(customerId: string, createBookingDto: CreateBookingDto): Promise<Booking> {
    // Validate vehicle capacity before creating booking
    await this.validateVehicleCapacity(
      createBookingDto.vehicleType as VehicleType,
      createBookingDto.passengerCount,
      createBookingDto.luggageCount,
    );

    // Check for existing duplicate booking
    const existingBooking = await this.findDuplicateBooking(
      customerId,
      createBookingDto.pickupLat,
      createBookingDto.pickupLng,
      createBookingDto.dropoffLat,
      createBookingDto.dropoffLng,
      new Date(createBookingDto.pickupDatetime),
    );

    if (existingBooking) {
      // Return existing booking instead of creating duplicate
      return existingBooking;
    }

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
        // Airport-specific fields
        terminal: createBookingDto.terminal || null,
        hasMeetAndGreet: createBookingDto.hasMeetAndGreet ?? false,
        // Service options
        childSeats: createBookingDto.childSeats ?? 0,
        boosterSeats: createBookingDto.boosterSeats ?? 0,
        // Lead passenger contact
        customerName: createBookingDto.customerName || null,
        customerEmail: createBookingDto.customerEmail || null,
        customerPhone: createBookingDto.customerPhone || null,
        status: BookingStatus.PENDING_PAYMENT,
        customerPrice: new Prisma.Decimal(createBookingDto.customerPrice.toString()),
      },
    });

    // Create stops if provided
    if (createBookingDto.stops && createBookingDto.stops.length > 0) {
      await this.createStops(booking.id, createBookingDto.stops);
    }

    return booking;
  }

  /**
   * Create booking stops
   */
  private async createStops(
    bookingId: string,
    stops: StopDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;
    await client.bookingStop.createMany({
      data: stops.map((stop, index) => ({
        bookingId,
        stopOrder: index + 1,
        address: stop.address,
        postcode: stop.postcode || null,
        lat: stop.lat,
        lng: stop.lng,
        notes: stop.notes || null,
      })),
    });
  }

  /**
   * Create a return journey (BookingGroup with outbound + return bookings)
   * Returns existing booking group if duplicate detected (idempotent)
   */
  async createReturnJourney(
    customerId: string,
    dto: CreateReturnBookingDto,
  ): Promise<{ bookingGroup: BookingGroup; outboundBooking: Booking; returnBooking: Booking }> {
    // Validate vehicle capacity for both legs
    await this.validateVehicleCapacity(
      dto.outbound.vehicleType as VehicleType,
      dto.outbound.passengerCount,
      dto.outbound.luggageCount,
    );
    await this.validateVehicleCapacity(
      dto.returnJourney.vehicleType as VehicleType,
      dto.returnJourney.passengerCount,
      dto.returnJourney.luggageCount,
    );

    // Check for existing duplicate return journey
    const existingGroup = await this.findDuplicateReturnJourney(
      customerId,
      dto.outbound.pickupLat,
      dto.outbound.pickupLng,
      dto.outbound.dropoffLat,
      dto.outbound.dropoffLng,
      new Date(dto.outbound.pickupDatetime),
    );

    if (existingGroup) {
      // Return existing booking group instead of creating duplicate
      const outboundBooking = existingGroup.bookings.find(b => b.journeyType === JourneyType.OUTBOUND);
      const returnBooking = existingGroup.bookings.find(b => b.journeyType === JourneyType.RETURN);

      if (outboundBooking && returnBooking) {
        return {
          bookingGroup: existingGroup,
          outboundBooking,
          returnBooking,
        };
      }
    }

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
          // Airport-specific fields
          terminal: dto.outbound.terminal || null,
          hasMeetAndGreet: dto.outbound.hasMeetAndGreet ?? false,
          // Service options
          childSeats: dto.outbound.childSeats ?? 0,
          boosterSeats: dto.outbound.boosterSeats ?? 0,
          // Lead passenger contact
          customerName: dto.outbound.customerName || null,
          customerEmail: dto.outbound.customerEmail || null,
          customerPhone: dto.outbound.customerPhone || null,
          status: BookingStatus.PENDING_PAYMENT,
          customerPrice: new Prisma.Decimal(dto.outbound.customerPrice.toString()),
        },
      });

      // Create stops for outbound if provided
      if (dto.outbound.stops && dto.outbound.stops.length > 0) {
        await this.createStops(outboundBooking.id, dto.outbound.stops, tx);
      }

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
          // Airport-specific fields
          terminal: dto.returnJourney.terminal || null,
          hasMeetAndGreet: dto.returnJourney.hasMeetAndGreet ?? false,
          // Service options
          childSeats: dto.returnJourney.childSeats ?? 0,
          boosterSeats: dto.returnJourney.boosterSeats ?? 0,
          // Lead passenger contact
          customerName: dto.returnJourney.customerName || null,
          customerEmail: dto.returnJourney.customerEmail || null,
          customerPhone: dto.returnJourney.customerPhone || null,
          status: BookingStatus.PENDING_PAYMENT,
          customerPrice: new Prisma.Decimal(dto.returnJourney.customerPrice.toString()),
        },
      });

      // Create stops for return if provided
      if (dto.returnJourney.stops && dto.returnJourney.stops.length > 0) {
        await this.createStops(returnBooking.id, dto.returnJourney.stops, tx);
      }

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
        customer: true,
        stops: { orderBy: { stopOrder: 'asc' } },
        job: {
          include: {
            assignedOperator: {
              select: {
                id: true,
                companyName: true,
                emergencyContactPhone: true,
              },
            },
            driverDetails: {
              select: {
                id: true,
                driverName: true,
                driverPhone: true,
                vehicleRegistration: true,
                vehicleMake: true,
                vehicleModel: true,
                vehicleColor: true,
                taxiLicenceNumber: true,
                issuingCouncil: true,
              },
            },
            assignedDriver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                email: true,
                profileImageUrl: true,
              },
            },
            assignedVehicle: {
              select: {
                id: true,
                vehicleType: true,
                registrationPlate: true,
                make: true,
                model: true,
                year: true,
                color: true,
                photos: true,
              },
            },
          },
        },
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
        customer: true,
        stops: { orderBy: { stopOrder: 'asc' } },
        job: {
          include: {
            assignedOperator: {
              select: {
                id: true,
                companyName: true,
                emergencyContactPhone: true,
              },
            },
            driverDetails: {
              select: {
                id: true,
                driverName: true,
                driverPhone: true,
                vehicleRegistration: true,
                vehicleMake: true,
                vehicleModel: true,
                vehicleColor: true,
                taxiLicenceNumber: true,
                issuingCouncil: true,
              },
            },
            assignedDriver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                email: true,
                profileImageUrl: true,
              },
            },
            assignedVehicle: {
              select: {
                id: true,
                vehicleType: true,
                registrationPlate: true,
                make: true,
                model: true,
                year: true,
                color: true,
                photos: true,
              },
            },
          },
        },
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
  async findBookingGroup(groupId: string): Promise<BookingGroup & { bookings: BookingWithRelations[] }> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: groupId },
      include: {
        bookings: {
          orderBy: { journeyType: 'asc' }, // OUTBOUND first, then RETURN
          include: {
            stops: { orderBy: { stopOrder: 'asc' } },
          },
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
  async findBookingGroupByReference(groupReference: string): Promise<BookingGroup & { bookings: BookingWithRelations[] }> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { groupReference },
      include: {
        bookings: {
          orderBy: { journeyType: 'asc' },
          include: {
            stops: { orderBy: { stopOrder: 'asc' } },
          },
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
      include: {
        stops: { orderBy: { stopOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get all booking groups (return journeys)
    const bookingGroups = await this.prisma.bookingGroup.findMany({
      where: { customerId },
      include: {
        bookings: {
          orderBy: { journeyType: 'asc' },
          include: {
            stops: { orderBy: { stopOrder: 'asc' } },
          },
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

  async update(id: string, updateBookingDto: UpdateBookingDto, userRole?: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        job: {
          include: {
            assignedOperator: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    // Only allow updates if booking is in PENDING_PAYMENT or PAID status
    const allowedStatuses: BookingStatus[] = [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException('Cannot update booking in current status');
    }

    // Validate: Cannot amend booking within 24 hours of pickup or after pickup has passed
    // Skip validation for admins (customer service override)
    const isAdmin = userRole === 'ADMIN';

    if (!isAdmin) {
      const now = new Date();
      const pickupTime = new Date(booking.pickupDatetime);
      const hoursUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilPickup < 0) {
        throw new BadRequestException(
          `Cannot amend booking after the scheduled pickup time has passed. ` +
          `Pickup was scheduled for ${pickupTime.toISOString()}.`
        );
      }

      if (hoursUntilPickup < 24) {
        throw new BadRequestException(
          `Cannot amend booking within 24 hours of pickup. ` +
          `Pickup is scheduled for ${pickupTime.toISOString()} (in ${hoursUntilPickup.toFixed(1)} hours). ` +
          `Please contact support for urgent changes.`
        );
      }
    }

    // Track changes for notification
    const changes: string[] = [];
    if (updateBookingDto.pickupDatetime && new Date(updateBookingDto.pickupDatetime).getTime() !== booking.pickupDatetime.getTime()) {
      changes.push('Pickup date/time');
    }
    if (updateBookingDto.passengerCount !== undefined && updateBookingDto.passengerCount !== booking.passengerCount) {
      changes.push('Passenger count');
    }
    if (updateBookingDto.luggageCount !== undefined && updateBookingDto.luggageCount !== booking.luggageCount) {
      changes.push('Luggage count');
    }
    if (updateBookingDto.specialRequirements !== undefined && updateBookingDto.specialRequirements !== booking.specialRequirements) {
      changes.push('Special requirements');
    }

    const updatedBooking = await this.prisma.booking.update({
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

    // Send modification notification if there were changes
    if (changes.length > 0) {
      // Send notification to customer
      this.notificationsService
        .sendBookingModification(
          booking.customerId,
          booking.bookingReference,
          updatedBooking.pickupAddress,
          updatedBooking.dropoffAddress,
          updatedBooking.pickupDatetime,
          changes,
        )
        .catch((err) => {
          this.logger.error(`Failed to send booking modification notification: ${err.message}`);
        });

      // Send notification to assigned operator if job exists and operator is assigned
      if (booking.job?.assignedOperator) {
        this.notificationsService
          .sendOperatorJobModification({
            operatorId: booking.job.assignedOperator.id,
            operatorEmail: booking.job.assignedOperator.user.email,
            operatorPhone: booking.job.assignedOperator.user.phoneNumber,
            operatorName: booking.job.assignedOperator.companyName,
            bookingReference: booking.bookingReference,
            pickupAddress: updatedBooking.pickupAddress,
            dropoffAddress: updatedBooking.dropoffAddress,
            pickupDatetime: updatedBooking.pickupDatetime,
            passengerCount: updatedBooking.passengerCount,
            luggageCount: updatedBooking.luggageCount,
            vehicleType: updatedBooking.vehicleType,
            changes,
          })
          .catch((err) => {
            this.logger.error(`Failed to send operator job modification notification: ${err.message}`);
          });
      }
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

  formatBookingResponse(booking: Booking | BookingWithRelations): BookingResponse {
    const bookingWithRelations = booking as BookingWithRelations;
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
      // Airport-specific fields
      terminal: booking.terminal,
      hasMeetAndGreet: booking.hasMeetAndGreet,
      // Service options
      childSeats: booking.childSeats,
      boosterSeats: booking.boosterSeats,
      // Intermediate stops
      stops: (bookingWithRelations.stops || [])
        .sort((a, b) => a.stopOrder - b.stopOrder)
        .map((s) => ({
          id: s.id,
          stopOrder: s.stopOrder,
          address: s.address,
          postcode: s.postcode,
          lat: Number(s.lat),
          lng: Number(s.lng),
          notes: s.notes,
        })),
      // Pricing and linking
      customerPrice: Number(booking.customerPrice),
      linkedBookingId: booking.linkedBookingId,
      bookingGroupId: booking.bookingGroupId,
      createdAt: booking.createdAt.toISOString(),
      // Customer data (include if available from relation)
      customerId: booking.customerId,
      customerName: booking.customerName || (bookingWithRelations.customer ? `${bookingWithRelations.customer.firstName} ${bookingWithRelations.customer.lastName}` : null),
      customerEmail: booking.customerEmail || bookingWithRelations.customer?.email || null,
      customerPhone: booking.customerPhone || bookingWithRelations.customer?.phoneNumber || null,
      // Assigned operator info (if operator is assigned)
      assignedOperator: bookingWithRelations.job?.assignedOperator || null,
      // Driver details (if driver details are submitted)
      driverDetails: bookingWithRelations.job?.driverDetails || null,
    };
  }

  formatBookingGroupResponse(group: BookingGroup & { bookings: BookingWithRelations[] }): BookingGroupResponse {
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
  // DUPLICATE DETECTION
  // =========================================================================

  /**
   * Find existing PENDING_PAYMENT booking with same journey details
   * created within the duplicate detection window
   */
  private async findDuplicateBooking(
    customerId: string,
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    pickupDatetime: Date,
  ): Promise<Booking | null> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - DUPLICATE_DETECTION_WINDOW_MINUTES);

    // Find booking with same customer, locations, and pickup time
    // created within the detection window and still pending payment
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        customerId,
        journeyType: JourneyType.ONE_WAY,
        status: BookingStatus.PENDING_PAYMENT,
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        pickupDatetime,
        createdAt: {
          gte: windowStart,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return existingBooking;
  }

  /**
   * Find existing PENDING_PAYMENT return journey with same outbound details
   * created within the duplicate detection window
   */
  private async findDuplicateReturnJourney(
    customerId: string,
    outboundPickupLat: number,
    outboundPickupLng: number,
    outboundDropoffLat: number,
    outboundDropoffLng: number,
    outboundPickupDatetime: Date,
  ): Promise<(BookingGroup & { bookings: Booking[] }) | null> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - DUPLICATE_DETECTION_WINDOW_MINUTES);

    // Find booking groups with matching outbound journey
    const existingGroup = await this.prisma.bookingGroup.findFirst({
      where: {
        customerId,
        status: 'ACTIVE',
        createdAt: {
          gte: windowStart,
        },
        bookings: {
          some: {
            journeyType: JourneyType.OUTBOUND,
            status: BookingStatus.PENDING_PAYMENT,
            pickupLat: outboundPickupLat,
            pickupLng: outboundPickupLng,
            dropoffLat: outboundDropoffLat,
            dropoffLng: outboundDropoffLng,
            pickupDatetime: outboundPickupDatetime,
          },
        },
      },
      include: {
        bookings: {
          orderBy: { journeyType: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return existingGroup;
  }

  // =========================================================================
  // VEHICLE CAPACITY VALIDATION
  // =========================================================================

  /**
   * Validate passenger and luggage count against vehicle capacity
   */
  private async validateVehicleCapacity(
    vehicleType: VehicleType,
    passengerCount: number,
    luggageCount: number,
  ): Promise<void> {
    const capacity = await this.vehicleCapacityService.findByVehicleType(vehicleType);

    if (passengerCount > capacity.maxPassengers) {
      throw new BadRequestException(
        `${vehicleType} vehicle can accommodate maximum ${capacity.maxPassengers} passengers. ` +
        `You requested ${passengerCount} passengers.`
      );
    }

    if (luggageCount > capacity.maxSuitcases) {
      throw new BadRequestException(
        `${vehicleType} vehicle can accommodate maximum ${capacity.maxSuitcases} suitcases. ` +
        `You requested ${luggageCount} suitcases.`
      );
    }
  }

  // =========================================================================
  // CANCELLATION POLICY
  // =========================================================================

  /**
   * Cancel a booking with:
   * - Stripe refund processing (based on cancellation policy)
   * - Customer notification (email + SMS)
   * - Operator notification if job was assigned
   * - Job status update to CANCELLED
   */
  async cancelBooking(
    bookingId: string,
    reason?: string,
  ): Promise<{ booking: Booking; refundAmount: number; refundPercent: number }> {
    // Fetch booking with related job and transaction data
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        transactions: true,
        job: {
          include: {
            assignedOperator: true,
            bids: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.REFUNDED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    // Validate: Cannot cancel booking after pickup time has passed
    const now = new Date();
    const pickupTime = new Date(booking.pickupDatetime);

    if (now >= pickupTime) {
      throw new BadRequestException(
        `Cannot cancel booking after the scheduled pickup time has passed. ` +
        `Pickup was scheduled for ${pickupTime.toISOString()}`
      );
    }

    // Calculate refund based on cancellation policy
    const { refundAmount, refundPercent } = await this.calculateCancellationRefund(booking);

    // 1. Process Stripe refund if applicable
    const originalPayment = booking.transactions.find(
      (t) => t.transactionType === TransactionType.CUSTOMER_PAYMENT && t.status === 'COMPLETED',
    );

    if (refundAmount > 0 && originalPayment?.stripeTransactionId) {
      try {
        const amountInPence = Math.round(refundAmount * 100);
        await this.stripeService.refundPayment(
          originalPayment.stripeTransactionId,
          amountInPence,
          reason || 'Customer cancellation',
        );

        // Create refund transaction record
        await this.prisma.transaction.create({
          data: {
            bookingId,
            amount: refundAmount,
            transactionType: TransactionType.REFUND,
            status: 'COMPLETED',
          },
        });

        this.logger.log(`Processed Stripe refund of £${refundAmount} for booking ${booking.bookingReference}`);
      } catch (error) {
        this.logger.error(`Failed to process Stripe refund for booking ${bookingId}`, error);
        // Continue with cancellation even if refund fails - admin can handle manually
      }
    }

    // 2. Cancel associated job if exists
    let assignedOperatorId: string | undefined;
    if (booking.job) {
      assignedOperatorId = booking.job.assignedOperatorId || undefined;

      // Update job status to CANCELLED
      await this.prisma.job.update({
        where: { id: booking.job.id },
        data: { status: JobStatus.CANCELLED },
      });

      // Mark all pending bids as LOST
      if (booking.job.bids.length > 0) {
        await this.prisma.bid.updateMany({
          where: {
            jobId: booking.job.id,
            status: { in: [BidStatus.PENDING, BidStatus.OFFERED] },
          },
          data: { status: BidStatus.DECLINED },
        });
      }

      this.logger.log(`Cancelled job ${booking.job.id} for booking ${booking.bookingReference}`);
    }

    // 3. Update booking status
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason || null,
        refundAmount: new Prisma.Decimal(refundAmount.toString()),
        refundPercent,
      },
    });

    // 4. Update booking group status if part of return journey
    if (booking.bookingGroupId) {
      await this.updateBookingGroupStatus(booking.bookingGroupId);
    }

    // 5. Send notifications (async - don't block response)
    this.notificationsService.sendBookingCancellation({
      customerId: booking.customerId,
      bookingReference: booking.bookingReference,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupDatetime: booking.pickupDatetime,
      refundAmount: `£${refundAmount.toFixed(2)}`,
      refundPercent,
      cancellationReason: reason,
      assignedOperatorId,
    }).catch((error) => {
      this.logger.error(`Failed to send cancellation notifications for booking ${bookingId}`, error);
    });

    this.logger.log(`Booking ${booking.bookingReference} cancelled. Refund: £${refundAmount} (${refundPercent}%)`);

    return { booking: updatedBooking, refundAmount, refundPercent };
  }

  /**
   * Calculate refund amount based on cancellation policy tiers
   */
  private async calculateCancellationRefund(
    booking: Booking,
  ): Promise<{ refundAmount: number; refundPercent: number }> {
    const now = new Date();
    const pickupTime = new Date(booking.pickupDatetime);
    const hoursUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Get cancellation policies ordered by hoursBeforePickup DESC
    const policies = await this.prisma.cancellationPolicy.findMany({
      where: { isActive: true },
      orderBy: { hoursBeforePickup: 'desc' },
    });

    // Find applicable policy (first one where hoursUntilPickup >= hoursBeforePickup)
    let refundPercent = 0;
    for (const policy of policies) {
      if (hoursUntilPickup >= policy.hoursBeforePickup) {
        refundPercent = policy.refundPercent;
        break;
      }
    }

    const customerPrice = Number(booking.customerPrice);
    const refundAmount = Math.round((customerPrice * refundPercent) / 100 * 100) / 100;

    return { refundAmount, refundPercent };
  }

  // =========================================================================
  // NO-SHOW HANDLING
  // =========================================================================

  /**
   * Mark a booking as no-show
   */
  async markAsNoShow(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BookingStatus.ASSIGNED && booking.status !== BookingStatus.IN_PROGRESS) {
      throw new BadRequestException('Only assigned or in-progress bookings can be marked as no-show');
    }

    // Validate: Cannot mark as no-show before pickup time has passed
    const now = new Date();
    const pickupTime = new Date(booking.pickupDatetime);
    const graceMinutes = 15; // Grace period after scheduled pickup time
    const earliestNoShowTime = new Date(pickupTime.getTime() + graceMinutes * 60 * 1000);

    if (now < earliestNoShowTime) {
      const minutesUntilAllowed = Math.ceil((earliestNoShowTime.getTime() - now.getTime()) / (1000 * 60));
      throw new BadRequestException(
        `Cannot mark as no-show before the scheduled pickup time. ` +
        `Pickup was scheduled for ${pickupTime.toISOString()}. ` +
        `No-show can be marked ${minutesUntilAllowed} minutes from now (${graceMinutes} min grace period after pickup).`
      );
    }

    // Get no-show charge percentage from settings
    const noShowChargePercent = await this.systemSettingsService.getSettingOrDefault(
      'NO_SHOW_CHARGE_PERCENT',
      100,
    );

    const customerPrice = Number(booking.customerPrice);
    const noShowCharges = Math.round((customerPrice * noShowChargePercent) / 100 * 100) / 100;

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.NO_SHOW,
        markedNoShowAt: new Date(),
        noShowCharges: new Prisma.Decimal(noShowCharges.toString()),
      },
    });

    return updatedBooking;
  }

  // =========================================================================
  // WAITING TIME CALCULATION
  // =========================================================================

  /**
   * Record driver arrival and calculate waiting charges
   */
  async recordDriverArrival(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { driverArrivedAt: new Date() },
    });
  }

  /**
   * Record passenger pickup and calculate waiting charges
   */
  async recordPassengerPickup(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.driverArrivedAt) {
      throw new BadRequestException('Driver arrival must be recorded first');
    }

    const waitingCharges = await this.calculateWaitingCharges(booking);

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        passengerPickedUpAt: new Date(),
        waitingCharges: new Prisma.Decimal(waitingCharges.toString()),
        status: BookingStatus.IN_PROGRESS,
      },
    });
  }

  /**
   * Calculate waiting charges based on service type
   */
  private async calculateWaitingCharges(booking: Booking): Promise<number> {
    if (!booking.driverArrivedAt) return 0;

    const now = new Date();
    const waitingMinutes = (now.getTime() - booking.driverArrivedAt.getTime()) / (1000 * 60);

    const isAirport = booking.serviceType === 'AIRPORT_PICKUP';

    // Get settings
    const freeWaitingMinutes = isAirport
      ? await this.systemSettingsService.getSettingOrDefault('AIRPORT_FREE_WAITING_MINUTES', 60)
      : await this.systemSettingsService.getSettingOrDefault('NON_AIRPORT_FREE_WAITING_MINUTES', 45);

    const ratePerMinute = isAirport
      ? await this.systemSettingsService.getSettingOrDefault('AIRPORT_WAITING_RATE_PER_MINUTE', 0.35)
      : await this.systemSettingsService.getSettingOrDefault('NON_AIRPORT_WAITING_RATE_PER_MINUTE', 0.25);

    if (waitingMinutes <= freeWaitingMinutes) {
      return 0;
    }

    const chargeableMinutes = waitingMinutes - freeWaitingMinutes;
    const charges = Math.round(chargeableMinutes * ratePerMinute * 100) / 100;

    return charges;
  }

  // =========================================================================
  // AMENDMENT FEE
  // =========================================================================

  /**
   * Apply amendment fee when booking is modified and recalculate price
   */
  async applyAmendmentFee(
    bookingId: string,
    recalculatePrice: boolean = true,
  ): Promise<{ booking: Booking; newPrice: number; amendmentFee: number }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        stops: { orderBy: { stopOrder: 'asc' } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const amendmentFee = await this.systemSettingsService.getSettingOrDefault('AMENDMENT_FEE', 15);
    const originalPrice = Number(booking.customerPrice);

    let newPrice = originalPrice;

    // Recalculate price based on current booking details
    if (recalculatePrice) {
      const quote = await this.quoteService.calculateQuote({
        pickupLat: Number(booking.pickupLat),
        pickupLng: Number(booking.pickupLng),
        dropoffLat: Number(booking.dropoffLat),
        dropoffLng: Number(booking.dropoffLng),
        vehicleType: booking.vehicleType,
        pickupDatetime: booking.pickupDatetime.toISOString(),
        meetAndGreet: false, // Keep existing add-ons
        childSeats: booking.childSeats || 0,
        boosterSeats: booking.boosterSeats || 0,
        stops: booking.stops.map((s) => ({
          address: s.address,
          lat: Number(s.lat),
          lng: Number(s.lng),
          postcode: s.postcode || undefined,
        })),
      });
      newPrice = quote.totalPrice;
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        amendedAt: new Date(),
        amendmentFee: new Prisma.Decimal(amendmentFee.toString()),
        originalPrice: new Prisma.Decimal(originalPrice.toString()),
        customerPrice: new Prisma.Decimal((newPrice + amendmentFee).toString()),
      },
    });

    return { booking: updatedBooking, newPrice: newPrice + amendmentFee, amendmentFee };
  }

  // =========================================================================
  // NEW BOOKING DISCOUNT
  // =========================================================================

  /**
   * Check if customer is eligible for new booking discount (first booking)
   */
  async isEligibleForNewBookingDiscount(customerId: string): Promise<boolean> {
    const existingBookings = await this.prisma.booking.count({
      where: {
        customerId,
        status: {
          in: [BookingStatus.COMPLETED, BookingStatus.PAID, BookingStatus.ASSIGNED],
        },
      },
    });

    return existingBookings === 0;
  }

  /**
   * Calculate new booking discount
   */
  async calculateNewBookingDiscount(
    customerId: string,
    originalPrice: number,
  ): Promise<{ discountAmount: number; discountPercent: number; finalPrice: number }> {
    const isEligible = await this.isEligibleForNewBookingDiscount(customerId);

    if (!isEligible) {
      return { discountAmount: 0, discountPercent: 0, finalPrice: originalPrice };
    }

    const discountPercent = await this.systemSettingsService.getSettingOrDefault(
      'NEW_BOOKING_DISCOUNT_PERCENT',
      10,
    );

    const discountAmount = Math.round((originalPrice * discountPercent) / 100 * 100) / 100;
    const finalPrice = Math.round((originalPrice - discountAmount) * 100) / 100;

    return { discountAmount, discountPercent, finalPrice };
  }

  // =========================================================================
  // CHILD SEAT REFUND
  // =========================================================================

  /**
   * Refund child seat fee if child seat was unavailable
   */
  async refundChildSeatFee(
    bookingId: string,
    reason: string = 'Child seat unavailable',
  ): Promise<{ booking: Booking; refundAmount: number }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.childSeats || booking.childSeats === 0) {
      throw new BadRequestException('No child seats were booked');
    }

    const childSeatFee = await this.systemSettingsService.getSettingOrDefault('CHILD_SEAT_FEE', 10);
    const refundAmount = childSeatFee * booking.childSeats;

    const currentPrice = Number(booking.customerPrice);
    const newPrice = Math.max(0, currentPrice - refundAmount);

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        customerPrice: new Prisma.Decimal(newPrice.toString()),
        childSeats: 0, // Remove child seats from booking
        specialRequirements: booking.specialRequirements
          ? `${booking.specialRequirements}. REFUND: ${reason} (£${refundAmount.toFixed(2)})`
          : `REFUND: ${reason} (£${refundAmount.toFixed(2)})`,
      },
    });

    return { booking: updatedBooking, refundAmount };
  }

  /**
   * Refund booster seat fee if booster seat was unavailable
   */
  async refundBoosterSeatFee(
    bookingId: string,
    reason: string = 'Booster seat unavailable',
  ): Promise<{ booking: Booking; refundAmount: number }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.boosterSeats || booking.boosterSeats === 0) {
      throw new BadRequestException('No booster seats were booked');
    }

    const boosterSeatFee = await this.systemSettingsService.getSettingOrDefault('BOOSTER_SEAT_FEE', 5);
    const refundAmount = boosterSeatFee * booking.boosterSeats;

    const currentPrice = Number(booking.customerPrice);
    const newPrice = Math.max(0, currentPrice - refundAmount);

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        customerPrice: new Prisma.Decimal(newPrice.toString()),
        boosterSeats: 0, // Remove booster seats from booking
        specialRequirements: booking.specialRequirements
          ? `${booking.specialRequirements}. REFUND: ${reason} (£${refundAmount.toFixed(2)})`
          : `REFUND: ${reason} (£${refundAmount.toFixed(2)})`,
      },
    });

    return { booking: updatedBooking, refundAmount };
  }

  // =========================================================================
  // REFERENCE GENERATORS
  // =========================================================================

  private generateBookingReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TTSG-${timestamp}${random}`;
  }

  private generateGroupReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TTSG-GRP-${timestamp}${random}`;
  }
}

