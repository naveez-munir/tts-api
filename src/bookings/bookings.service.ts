import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { Transaction } from './entities/transaction.entity';
import {
  BookingStatus,
  TransactionType,
  TransactionStatus,
} from '../common/enums';
import { QuoteService, QuoteResult } from './services/quote.service';
import { StripeService } from '../integrations/stripe/stripe.service';
import { CreateBookingDto, QuoteRequestDto, UpdateBookingDto } from './dto';
import { randomBytes } from 'crypto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    private quoteService: QuoteService,
    private stripeService: StripeService,
  ) {}

  async getQuote(request: QuoteRequestDto): Promise<QuoteResult> {
    // Validate pickup datetime is in the future
    const pickupDate = new Date(request.pickupDatetime);
    if (pickupDate <= new Date()) {
      throw new BadRequestException('Pickup datetime must be in the future');
    }

    return this.quoteService.calculateQuote(request);
  }

  async create(
    dto: CreateBookingDto,
    customerId: string,
  ): Promise<{
    booking: Booking;
    paymentIntent: { clientSecret: string; amount: number; currency: string };
  }> {
    // Validate pickup datetime
    const pickupDate = new Date(dto.pickupDatetime);
    if (pickupDate <= new Date()) {
      throw new BadRequestException('Pickup datetime must be in the future');
    }

    // Calculate quote
    const quoteRequest: QuoteRequestDto = {
      serviceType: dto.serviceType,
      pickupLocation: dto.pickupLocation,
      dropoffLocation: dto.dropoffLocation,
      pickupDatetime: dto.pickupDatetime,
      passengerCount: dto.passengerCount,
      luggageCount: dto.luggageCount,
      vehicleType: dto.vehicleType,
      hasMeetAndGreet: dto.hasMeetAndGreet,
      isReturnJourney: dto.isReturnJourney,
      viaPoints: dto.viaPoints,
    };

    const quote = await this.quoteService.calculateQuote(quoteRequest);

    // Generate booking reference
    const bookingReference = this.generateBookingReference();

    // Create booking
    const booking = this.bookingRepo.create({
      bookingReference,
      customerId,
      status: BookingStatus.PENDING_PAYMENT,
      serviceType: dto.serviceType,
      pickupAddress: dto.pickupLocation.address,
      pickupPostcode: dto.pickupLocation.postcode,
      pickupLat: dto.pickupLocation.lat,
      pickupLng: dto.pickupLocation.lng,
      dropoffAddress: dto.dropoffLocation.address,
      dropoffPostcode: dto.dropoffLocation.postcode,
      dropoffLat: dto.dropoffLocation.lat,
      dropoffLng: dto.dropoffLocation.lng,
      pickupDatetime: pickupDate,
      passengerCount: dto.passengerCount,
      luggageCount: dto.luggageCount,
      vehicleType: dto.vehicleType,
      flightNumber: dto.flightNumber,
      terminal: dto.terminal,
      hasMeetAndGreet: dto.hasMeetAndGreet ?? false,
      specialRequirements: dto.specialRequirements,
      viaPoints: dto.viaPoints,
      distanceMiles: quote.distanceMiles,
      durationMinutes: quote.durationMinutes,
      quotedPrice: quote.totalPrice,
      isReturnJourney: dto.isReturnJourney ?? false,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
    });

    const savedBooking = await this.bookingRepo.save(booking);

    // Create Stripe payment intent
    const paymentIntent = await this.stripeService.createPaymentIntent(
      quote.totalPrice,
      'GBP',
      {
        bookingId: savedBooking.id,
        bookingReference: savedBooking.bookingReference,
      },
    );

    // Create pending transaction
    const transaction = this.transactionRepo.create({
      bookingId: savedBooking.id,
      type: TransactionType.CUSTOMER_PAYMENT,
      status: TransactionStatus.PENDING,
      amount: quote.totalPrice,
      currency: 'GBP',
      stripePaymentIntentId: paymentIntent.paymentIntentId,
    });
    await this.transactionRepo.save(transaction);

    return {
      booking: savedBooking,
      paymentIntent: {
        clientSecret: paymentIntent.clientSecret,
        amount: quote.totalPrice,
        currency: 'GBP',
      },
    };
  }

  async findAll(
    customerId: string,
    options: {
      status?: BookingStatus;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ bookings: Booking[]; meta: PaginationMeta }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: any = { customerId };
    if (options.status) {
      where.status = options.status;
    }

    const [bookings, total] = await this.bookingRepo.findAndCount({
      where,
      order: { pickupDatetime: 'ASC' },
      skip,
      take: limit,
    });

    return {
      bookings,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, customerId?: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['transactions'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // If customerId provided, verify ownership
    if (customerId && booking.customerId !== customerId) {
      throw new ForbiddenException('Not authorized to view this booking');
    }

    return booking;
  }

  async findByReference(bookingReference: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { bookingReference },
      relations: ['transactions'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async update(
    id: string,
    dto: UpdateBookingDto,
    customerId: string,
  ): Promise<Booking> {
    const booking = await this.findOne(id, customerId);

    // Only allow updates before assignment
    if (
      booking.status !== BookingStatus.PENDING_PAYMENT &&
      booking.status !== BookingStatus.PAID
    ) {
      throw new ForbiddenException(
        'Cannot update booking in current status',
      );
    }

    // Validate new pickup datetime if provided
    if (dto.pickupDatetime) {
      const newPickupDate = new Date(dto.pickupDatetime);
      if (newPickupDate <= new Date()) {
        throw new BadRequestException(
          'Pickup datetime must be in the future',
        );
      }
      booking.pickupDatetime = newPickupDate;
    }

    if (dto.passengerCount !== undefined) {
      booking.passengerCount = dto.passengerCount;
    }

    if (dto.luggageCount !== undefined) {
      booking.luggageCount = dto.luggageCount;
    }

    if (dto.specialRequirements !== undefined) {
      booking.specialRequirements = dto.specialRequirements;
    }

    return this.bookingRepo.save(booking);
  }

  async cancel(
    id: string,
    customerId?: string,
  ): Promise<{ booking: Booking; refund?: { amount: number; status: string } }> {
    const booking = await this.findOne(id, customerId);

    // Check if booking can be cancelled
    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'Cannot cancel booking in current status',
      );
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();

    const savedBooking = await this.bookingRepo.save(booking);

    // Process refund if payment was made
    let refund: { amount: number; status: string } | undefined;
    const paymentTransaction = await this.transactionRepo.findOne({
      where: {
        bookingId: id,
        type: TransactionType.CUSTOMER_PAYMENT,
        status: TransactionStatus.COMPLETED,
      },
    });

    if (paymentTransaction) {
      const refundResult = await this.stripeService.refund(
        paymentTransaction.stripePaymentIntentId,
        Number(paymentTransaction.amount),
      );

      // Create refund transaction
      const refundTransaction = this.transactionRepo.create({
        bookingId: id,
        type: TransactionType.REFUND,
        status: TransactionStatus.COMPLETED,
        amount: paymentTransaction.amount,
        currency: 'GBP',
        stripeTransactionId: refundResult.refundId,
        description: 'Customer cancellation refund',
      });
      await this.transactionRepo.save(refundTransaction);

      // Update booking status to refunded
      savedBooking.status = BookingStatus.REFUNDED;
      await this.bookingRepo.save(savedBooking);

      refund = {
        amount: Number(paymentTransaction.amount),
        status: refundResult.status,
      };
    }

    return { booking: savedBooking, refund };
  }

  async confirmPayment(paymentIntentId: string): Promise<Booking> {
    // Find transaction by payment intent ID
    const transaction = await this.transactionRepo.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Update transaction status
    transaction.status = TransactionStatus.COMPLETED;
    transaction.completedAt = new Date();
    await this.transactionRepo.save(transaction);

    // Update booking status
    const booking = await this.bookingRepo.findOne({
      where: { id: transaction.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    booking.status = BookingStatus.PAID;
    return this.bookingRepo.save(booking);
  }

  private generateBookingReference(): string {
    // Generate format: BK + 6 alphanumeric characters
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomPart = Array.from(randomBytes(6))
      .map((b) => chars[b % chars.length])
      .join('');
    return `BK${randomPart}`;
  }
}
