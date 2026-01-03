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

@Controller('api/webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/webhooks/stripe
   * Handle Stripe webhook events
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const payload = req.body as Buffer;

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

    // Find booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      this.logger.warn(`Booking not found: ${bookingId}`);
      return;
    }

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        bookingId,
        amount: booking.customerPrice,
        transactionType: TransactionType.CUSTOMER_PAYMENT,
        stripeTransactionId: paymentIntent.id,
        status: 'COMPLETED',
      },
    });

    // Update booking status to PAID
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.PAID },
    });

    this.logger.log(`Payment succeeded for booking: ${bookingId}`);
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

