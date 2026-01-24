import {
  Controller,
  Post,
  Headers,
  Req,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeService } from './stripe.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingStatus, TransactionType } from '@prisma/client';
import { JobsCreationService } from '../../modules/jobs/jobs-creation.service.js';
import { SystemSettingsService } from '../../modules/system-settings/system-settings.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Controller('api/webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly jobsCreationService: JobsCreationService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * POST /api/webhooks/stripe
   * Handle Stripe webhook events
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request & { rawBody?: string },
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    this.logger.log('Received Stripe webhook');
    const payload = req.rawBody || JSON.stringify(req.body);

    // Verify webhook signature
    const event = this.stripeService.constructWebhookEvent(payload, signature);

    if (!event) {
      this.logger.warn('Webhook signature verification failed or Stripe not configured');
      // Return 200 to acknowledge receipt even if not processed
      return { received: true };
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook: ${event.type}`, error);
    }

    return { received: true };
  }

  private async handlePaymentSucceeded(paymentIntent: any): Promise<void> {
    const bookingId = paymentIntent.metadata?.bookingId;

    if (!bookingId) {
      this.logger.warn('Payment intent missing bookingId metadata');
      return;
    }

    const existingTransaction = await this.prisma.transaction.findFirst({
      where: { stripeTransactionId: paymentIntent.id },
    });

    if (existingTransaction) {
      this.logger.log(`Transaction already processed for payment intent: ${paymentIntent.id}`);
      return;
    }

    const bookingGroup = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingId },
      include: { bookings: true },
    });

    if (bookingGroup) {
      await this.handleBookingGroupPayment(bookingGroup, paymentIntent.id);
      return;
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      this.logger.warn(`Booking not found: ${bookingId}`);
      return;
    }

    await this.handleSingleBookingPayment(booking, paymentIntent.id);
  }

  private async handleSingleBookingPayment(booking: any, paymentIntentId: string): Promise<void> {
    await this.prisma.transaction.create({
      data: {
        bookingId: booking.id,
        amount: booking.customerPrice,
        transactionType: TransactionType.CUSTOMER_PAYMENT,
        stripeTransactionId: paymentIntentId,
        status: 'COMPLETED',
      },
    });

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.PAID },
    });

    const biddingWindowHours = await this.systemSettingsService.getSettingOrDefault(
      'DEFAULT_BIDDING_WINDOW_HOURS',
      24,
    );
    const job = await this.jobsCreationService.createJobForBooking(booking.id, biddingWindowHours);
    await this.jobsCreationService.broadcastJobToOperators(job.id, booking);

    // Send booking confirmation email to customer
    try {
      await this.notificationsService.sendBookingConfirmation({
        customerId: booking.customerId,
        bookingReference: booking.bookingReference,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        pickupDatetime: booking.pickupDatetime,
        vehicleType: booking.vehicleType,
        passengerCount: booking.passengerCount,
        totalPrice: `£${Number(booking.customerPrice).toFixed(2)}`,
      });
      this.logger.log(`Booking confirmation sent for: ${booking.bookingReference}`);
    } catch (error) {
      this.logger.error(`Failed to send booking confirmation for ${booking.bookingReference}:`, error);
    }

    this.logger.log(`Payment succeeded for booking: ${booking.id}, job ${job.id} created`);
  }

  private async handleBookingGroupPayment(bookingGroup: any, paymentIntentId: string): Promise<void> {
    for (const booking of bookingGroup.bookings) {
      await this.prisma.transaction.create({
        data: {
          bookingId: booking.id,
          amount: booking.customerPrice,
          transactionType: TransactionType.CUSTOMER_PAYMENT,
          stripeTransactionId: paymentIntentId,
          status: 'COMPLETED',
        },
      });

      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.PAID },
      });
    }

    const biddingWindowHours = await this.systemSettingsService.getSettingOrDefault(
      'RETURN_BIDDING_WINDOW_HOURS',
      2,
    );
    for (const booking of bookingGroup.bookings) {
      const job = await this.jobsCreationService.createJobForBooking(booking.id, biddingWindowHours);
      await this.jobsCreationService.broadcastJobToOperators(job.id, booking);
    }

    // Send return journey confirmation email to customer
    const outbound = bookingGroup.bookings.find((b: any) => b.journeyType === 'OUTBOUND');
    const returnBooking = bookingGroup.bookings.find((b: any) => b.journeyType === 'RETURN');

    if (outbound && returnBooking) {
      try {
        const discountAmount = bookingGroup.discountAmount
          ? `£${Number(bookingGroup.discountAmount).toFixed(2)}`
          : '£0.00';
        await this.notificationsService.sendReturnJourneyConfirmation({
          customerId: outbound.customerId,
          groupReference: bookingGroup.groupReference,
          totalPrice: `£${Number(bookingGroup.totalPrice).toFixed(2)}`,
          discountAmount,
          outbound: {
            bookingReference: outbound.bookingReference,
            pickupAddress: outbound.pickupAddress,
            dropoffAddress: outbound.dropoffAddress,
            pickupDatetime: outbound.pickupDatetime,
            vehicleType: outbound.vehicleType,
            passengerCount: outbound.passengerCount,
            price: `£${Number(outbound.customerPrice).toFixed(2)}`,
          },
          returnJourney: {
            bookingReference: returnBooking.bookingReference,
            pickupAddress: returnBooking.pickupAddress,
            dropoffAddress: returnBooking.dropoffAddress,
            pickupDatetime: returnBooking.pickupDatetime,
            vehicleType: returnBooking.vehicleType,
            passengerCount: returnBooking.passengerCount,
            price: `£${Number(returnBooking.customerPrice).toFixed(2)}`,
          },
        });
        this.logger.log(`Return journey confirmation sent for group: ${bookingGroup.groupReference}`);
      } catch (error) {
        this.logger.error(`Failed to send return journey confirmation for ${bookingGroup.groupReference}:`, error);
      }
    }

    this.logger.log(`Payment succeeded for booking group: ${bookingGroup.id}, ${bookingGroup.bookings.length} jobs created`);
  }

  private async handlePaymentFailed(paymentIntent: any): Promise<void> {
    const bookingId = paymentIntent.metadata?.bookingId;

    if (!bookingId) {
      return;
    }

    this.logger.warn(`Payment failed for booking: ${bookingId}`);

    // Optionally create a failed transaction record
    await this.prisma.transaction.create({
      data: {
        bookingId,
        amount: 0,
        transactionType: TransactionType.CUSTOMER_PAYMENT,
        stripeTransactionId: paymentIntent.id,
        status: 'FAILED',
      },
    });
  }

  private async handleChargeRefunded(charge: any): Promise<void> {
    const paymentIntentId = charge.payment_intent;

    // Find transaction by stripe ID
    const transaction = await this.prisma.transaction.findFirst({
      where: { stripeTransactionId: paymentIntentId },
      include: { booking: true },
    });

    if (!transaction) {
      this.logger.warn(`Transaction not found for payment intent: ${paymentIntentId}`);
      return;
    }

    // Create refund transaction
    await this.prisma.transaction.create({
      data: {
        bookingId: transaction.bookingId,
        amount: transaction.amount,
        transactionType: TransactionType.REFUND,
        stripeTransactionId: charge.id,
        status: 'COMPLETED',
      },
    });

    // Update booking status
    await this.prisma.booking.update({
      where: { id: transaction.bookingId },
      data: { status: BookingStatus.REFUNDED },
    });

    this.logger.log(`Refund processed for booking: ${transaction.bookingId}`);
  }
}

