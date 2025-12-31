import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { StripeService } from '../../integrations/stripe/stripe.service.js';
import { NotificationsService } from '../../integrations/notifications/notifications.service.js';
import { BiddingQueueService } from '../../queue/bidding-queue.service.js';
import { Transaction, TransactionType, JourneyType, JobStatus, OperatorApprovalStatus } from '@prisma/client';
import type { CreatePaymentIntentDto, ConfirmPaymentDto } from './dto/create-payment-intent.dto.js';

// DTO for booking group payment
export interface CreateGroupPaymentIntentDto {
  bookingGroupId: string;
  amount: string; // Total amount for both legs with discount
}

export interface ConfirmGroupPaymentDto {
  bookingGroupId: string;
  paymentIntentId: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly notificationsService: NotificationsService,
    private readonly biddingQueueService: BiddingQueueService,
  ) {}

  /**
   * Create payment intent for a single booking (one-way)
   */
  async createPaymentIntent(customerId: string, createPaymentIntentDto: CreatePaymentIntentDto): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: createPaymentIntentDto.bookingId },
      include: { customer: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== customerId) {
      throw new BadRequestException('Booking does not belong to this customer');
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Booking is not pending payment');
    }

    const amountInPence = Math.round(parseFloat(createPaymentIntentDto.amount) * 100);

    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: amountInPence,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      customerEmail: booking.customer.email,
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      description: `Airport Transfer: ${booking.pickupAddress} to ${booking.dropoffAddress}`,
    });

    return {
      paymentIntentId: paymentIntent.paymentIntentId,
      clientSecret: paymentIntent.clientSecret,
      bookingId: createPaymentIntentDto.bookingId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    };
  }

  /**
   * Create payment intent for a booking group (return journey)
   * Single payment for both legs with discount applied
   */
  async createGroupPaymentIntent(customerId: string, dto: CreateGroupPaymentIntentDto): Promise<any> {
    const bookingGroup = await this.prisma.bookingGroup.findUnique({
      where: { id: dto.bookingGroupId },
      include: {
        customer: true,
        bookings: {
          orderBy: { journeyType: 'asc' },
        },
      },
    });

    if (!bookingGroup) {
      throw new NotFoundException('Booking group not found');
    }

    if (bookingGroup.customerId !== customerId) {
      throw new BadRequestException('Booking group does not belong to this customer');
    }

    // Verify all bookings are pending payment
    const allPending = bookingGroup.bookings.every((b) => b.status === 'PENDING_PAYMENT');
    if (!allPending) {
      throw new BadRequestException('All bookings must be pending payment');
    }

    const outboundBooking = bookingGroup.bookings.find((b) => b.journeyType === JourneyType.OUTBOUND);
    if (!outboundBooking) {
      throw new BadRequestException('Outbound booking not found');
    }

    const amountInPence = Math.round(parseFloat(dto.amount) * 100);

    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: amountInPence,
      bookingId: bookingGroup.id, // Use group ID for reference
      bookingReference: bookingGroup.groupReference,
      customerEmail: bookingGroup.customer.email,
      customerName: `${bookingGroup.customer.firstName} ${bookingGroup.customer.lastName}`,
      description: `Return Journey: ${outboundBooking.pickupAddress} ↔ ${outboundBooking.dropoffAddress}`,
    });

    this.logger.log(`Created payment intent for booking group ${bookingGroup.groupReference}`);

    return {
      paymentIntentId: paymentIntent.paymentIntentId,
      clientSecret: paymentIntent.clientSecret,
      bookingGroupId: dto.bookingGroupId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    };
  }

  /**
   * Confirm payment for a single booking
   * Also creates job and broadcasts to operators
   */
  async confirmPayment(
    customerId: string,
    confirmPaymentDto: ConfirmPaymentDto,
    biddingWindowHours: number = 2,
  ): Promise<Transaction> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: confirmPaymentDto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== customerId) {
      throw new BadRequestException('Booking does not belong to this customer');
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        bookingId: confirmPaymentDto.bookingId,
        amount: booking.customerPrice,
        transactionType: TransactionType.CUSTOMER_PAYMENT,
        stripeTransactionId: confirmPaymentDto.paymentIntentId,
        status: 'COMPLETED',
      },
    });

    await this.prisma.booking.update({
      where: { id: confirmPaymentDto.bookingId },
      data: { status: 'PAID' },
    });

    // Create job for bidding
    const job = await this.createJobForBooking(booking.id, biddingWindowHours);

    // Broadcast to operators in service area
    await this.broadcastJobToOperators(job.id, booking);

    this.logger.log(`Payment confirmed for booking ${booking.bookingReference}, job ${job.id} created`);

    return transaction;
  }

  /**
   * Confirm payment for a booking group (return journey)
   * Creates transactions for both bookings, creates jobs, and broadcasts to operators
   */
  async confirmGroupPayment(
    customerId: string,
    dto: ConfirmGroupPaymentDto,
    biddingWindowHours: number = 2,
  ): Promise<{ transactions: Transaction[]; bookingGroupId: string }> {
    const bookingGroup = await this.prisma.bookingGroup.findUnique({
      where: { id: dto.bookingGroupId },
      include: {
        bookings: true,
      },
    });

    if (!bookingGroup) {
      throw new NotFoundException('Booking group not found');
    }

    if (bookingGroup.customerId !== customerId) {
      throw new BadRequestException('Booking group does not belong to this customer');
    }

    // Create transactions for each booking in the group
    const transactions = await this.prisma.$transaction(async (tx) => {
      const createdTransactions: Transaction[] = [];

      for (const booking of bookingGroup.bookings) {
        // Create transaction for each booking (proportional amount)
        const transaction = await tx.transaction.create({
          data: {
            bookingId: booking.id,
            amount: booking.customerPrice,
            transactionType: TransactionType.CUSTOMER_PAYMENT,
            stripeTransactionId: dto.paymentIntentId,
            status: 'COMPLETED',
          },
        });
        createdTransactions.push(transaction);

        // Update booking status
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'PAID' },
        });
      }

      return createdTransactions;
    });

    // Create jobs for both bookings and broadcast
    for (const booking of bookingGroup.bookings) {
      const job = await this.createJobForBooking(booking.id, biddingWindowHours);
      await this.broadcastJobToOperators(job.id, booking);
    }

    this.logger.log(`Confirmed payment for booking group ${bookingGroup.groupReference}, jobs created`);

    return {
      transactions,
      bookingGroupId: dto.bookingGroupId,
    };
  }

  async getTransactionHistory(bookingId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get transaction history for a booking group
   */
  async getGroupTransactionHistory(bookingGroupId: string): Promise<Transaction[]> {
    const bookingGroup = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      include: { bookings: true },
    });

    if (!bookingGroup) {
      throw new NotFoundException('Booking group not found');
    }

    const bookingIds = bookingGroup.bookings.map((b) => b.id);

    return this.prisma.transaction.findMany({
      where: {
        bookingId: { in: bookingIds },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Refund a single booking
   */
  async refundPayment(bookingId: string, reason: string): Promise<Transaction> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { bookingGroup: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const originalPayment = await this.prisma.transaction.findFirst({
      where: {
        bookingId,
        transactionType: TransactionType.CUSTOMER_PAYMENT,
        status: 'COMPLETED',
      },
    });

    if (originalPayment?.stripeTransactionId) {
      const amountInPence = Math.round(Number(booking.customerPrice) * 100);
      await this.stripeService.refundPayment(
        originalPayment.stripeTransactionId,
        amountInPence,
        reason,
      );
    }

    const refundTransaction = await this.prisma.transaction.create({
      data: {
        bookingId,
        amount: booking.customerPrice,
        transactionType: TransactionType.REFUND,
        status: 'COMPLETED',
      },
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'REFUNDED' },
    });

    // Update booking group status if part of return journey
    if (booking.bookingGroupId) {
      await this.updateBookingGroupStatus(booking.bookingGroupId);
    }

    this.logger.log(`Refunded booking ${booking.bookingReference}`);

    return refundTransaction;
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
    const allRefunded = statuses.every((s) => s === 'REFUNDED' || s === 'CANCELLED');
    const someRefunded = statuses.some((s) => s === 'REFUNDED' || s === 'CANCELLED');

    let newStatus: 'ACTIVE' | 'PARTIALLY_CANCELLED' | 'FULLY_CANCELLED' | 'COMPLETED' = 'ACTIVE';

    if (allRefunded) {
      newStatus = 'FULLY_CANCELLED';
    } else if (someRefunded) {
      newStatus = 'PARTIALLY_CANCELLED';
    }

    await this.prisma.bookingGroup.update({
      where: { id: groupId },
      data: { status: newStatus },
    });
  }

  /**
   * Create job for a booking and schedule bidding window close
   */
  private async createJobForBooking(bookingId: string, biddingWindowHours: number) {
    const now = new Date();
    const biddingWindowClosesAt = new Date();
    biddingWindowClosesAt.setHours(biddingWindowClosesAt.getHours() + biddingWindowHours);

    const job = await this.prisma.job.create({
      data: {
        bookingId,
        status: JobStatus.OPEN_FOR_BIDDING,
        biddingWindowOpensAt: now,
        biddingWindowClosesAt,
        biddingWindowDurationHours: biddingWindowHours,
      },
    });

    // Schedule automatic bidding window closure
    await this.biddingQueueService.scheduleBiddingWindowClose(job.id, biddingWindowClosesAt);

    return job;
  }

  /**
   * Broadcast job to all approved operators in service area
   */
  private async broadcastJobToOperators(jobId: string, booking: any) {
    // Find operators with service areas matching pickup postcode prefix
    const pickupPrefix = booking.pickupPostcode.substring(0, 3).toUpperCase();

    const operators = await this.prisma.operatorProfile.findMany({
      where: {
        approvalStatus: OperatorApprovalStatus.APPROVED,
        serviceAreas: {
          some: {
            postcode: {
              startsWith: pickupPrefix,
            },
          },
        },
      },
      select: { id: true },
    });

    if (operators.length === 0) {
      this.logger.warn(`No operators found for pickup area ${pickupPrefix}`);
      return;
    }

    const operatorIds = operators.map((o) => o.id);

    // Broadcast to all operators
    await this.notificationsService.broadcastNewJob({
      jobId,
      pickupAddress: booking.pickupAddress,
      pickupPostcode: booking.pickupPostcode,
      dropoffAddress: booking.dropoffAddress,
      dropoffPostcode: booking.dropoffPostcode,
      pickupDatetime: booking.pickupDatetime,
      vehicleType: booking.vehicleType,
      maxBidAmount: booking.customerPrice.toString(),
      operatorIds,
    });

    this.logger.log(`Broadcast job ${jobId} to ${operatorIds.length} operators`);
  }
}

