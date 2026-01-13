import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreatePaymentIntentParams {
  amount: number; // Amount in pence (GBP)
  bookingId: string;
  bookingReference: string;
  customerEmail: string;
  customerName: string;
  description?: string;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RefundResult {
  refundId: string;
  amount: number;
  status: string;
  paymentIntentId: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (secretKey && !secretKey.includes('your_key_here')) {
      this.stripe = new Stripe(secretKey);
      this.isConfigured = true;
      this.logger.log('Stripe configured successfully');
    } else {
      this.stripe = null;
      this.isConfigured = false;
      this.logger.warn('Stripe not configured - using mock mode');
    }
  }

  /**
   * Create a payment intent for a booking
   */
  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<PaymentIntentResult> {
    if (!this.isConfigured || !this.stripe) {
      return this.createMockPaymentIntent(params);
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount, // Amount in pence
        currency: 'gbp',
        metadata: {
          bookingId: params.bookingId,
          bookingReference: params.bookingReference,
        },
        receipt_email: params.customerEmail,
        description:
          params.description || `Airport Transfer Booking: ${params.bookingReference}`,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || '',
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      this.logger.error('Failed to create payment intent', error);
      throw new BadRequestException('Failed to create payment intent');
    }
  }

  /**
   * Retrieve a payment intent by ID
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    if (!this.isConfigured || !this.stripe) {
      return null;
    }

    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error('Failed to retrieve payment intent', error);
      return null;
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<boolean> {
    if (!this.isConfigured || !this.stripe) {
      return true; // Mock success
    }

    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel payment intent', error);
      return false;
    }
  }

  /**
   * Process a refund for a payment intent
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number, // Optional partial refund amount in pence
    _reason?: string,
  ): Promise<RefundResult> {
    if (!this.isConfigured || !this.stripe) {
      return this.createMockRefund(paymentIntentId, amount);
    }

    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
      };

      if (amount) {
        refundParams.amount = amount;
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status || 'succeeded',
        paymentIntentId,
      };
    } catch (error) {
      this.logger.error('Failed to process refund', error);
      throw new BadRequestException('Failed to process refund');
    }
  }

  /**
   * Verify webhook signature
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): Stripe.Event | null {
    if (!this.isConfigured || !this.stripe) {
      return null;
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.warn('Webhook secret not configured');
      return null;
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      return null;
    }
  }

  // Mock methods for development without Stripe keys
  private createMockPaymentIntent(
    params: CreatePaymentIntentParams,
  ): PaymentIntentResult {
    const mockId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return {
      paymentIntentId: mockId,
      clientSecret: `${mockId}_secret_mock`,
      amount: params.amount,
      currency: 'gbp',
      status: 'requires_payment_method',
    };
  }

  private createMockRefund(
    paymentIntentId: string,
    amount?: number,
  ): RefundResult {
    return {
      refundId: `re_mock_${Date.now()}`,
      amount: amount || 0,
      status: 'succeeded',
      paymentIntentId,
    };
  }
}

