import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PaymentsService } from './payments.service.js';
import {
  CreatePaymentIntentSchema,
  ConfirmPaymentSchema,
  CreateGroupPaymentIntentSchema,
  ConfirmGroupPaymentSchema,
} from './dto/create-payment-intent.dto.js';
import type {
  CreatePaymentIntentDto,
  ConfirmPaymentDto,
  CreateGroupPaymentIntentDto,
  ConfirmGroupPaymentDto,
} from './dto/create-payment-intent.dto.js';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  async createPaymentIntent(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreatePaymentIntentSchema)) createPaymentIntentDto: CreatePaymentIntentDto,
  ) {
    const paymentIntent = await this.paymentsService.createPaymentIntent(user.id, createPaymentIntentDto);
    return {
      success: true,
      data: paymentIntent,
    };
  }

  @Post('confirm')
  async confirmPayment(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(ConfirmPaymentSchema)) confirmPaymentDto: ConfirmPaymentDto,
  ) {
    const transaction = await this.paymentsService.confirmPayment(user.id, confirmPaymentDto);
    return {
      success: true,
      data: transaction,
      message: 'Payment confirmed successfully',
    };
  }

  @Get('history/:bookingId')
  async getTransactionHistory(@Param('bookingId') bookingId: string) {
    const transactions = await this.paymentsService.getTransactionHistory(bookingId);
    return {
      success: true,
      data: transactions,
      meta: {
        total: transactions.length,
      },
    };
  }

  @Post('refund/:bookingId')
  async refundPayment(
    @Param('bookingId') bookingId: string,
    @Body() body: { reason: string },
  ) {
    const transaction = await this.paymentsService.refundPayment(bookingId, body.reason);
    return {
      success: true,
      data: transaction,
      message: 'Refund processed successfully',
    };
  }

  // =========================================================================
  // GROUP PAYMENT ENDPOINTS (for return journeys)
  // =========================================================================

  /**
   * POST /payments/group/create-intent
   * Create Stripe payment intent for a booking group (return journey)
   * Single payment covers both outbound and return legs with discount applied
   */
  @Post('group/create-intent')
  @HttpCode(HttpStatus.CREATED)
  async createGroupPaymentIntent(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateGroupPaymentIntentSchema)) dto: CreateGroupPaymentIntentDto,
  ) {
    const paymentIntent = await this.paymentsService.createGroupPaymentIntent(user.id, dto);
    return {
      success: true,
      data: paymentIntent,
    };
  }

  /**
   * POST /payments/group/confirm
   * Confirm payment for a booking group (return journey)
   * Updates both bookings to PAID status
   */
  @Post('group/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmGroupPayment(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(ConfirmGroupPaymentSchema)) dto: ConfirmGroupPaymentDto,
  ) {
    const result = await this.paymentsService.confirmGroupPayment(user.id, dto);
    return {
      success: true,
      data: result,
      message: 'Group payment confirmed successfully',
    };
  }

  /**
   * GET /payments/group/:groupId/transactions
   * Get transaction history for a booking group
   */
  @Get('group/:groupId/transactions')
  async getGroupTransactionHistory(@Param('groupId') groupId: string) {
    const transactions = await this.paymentsService.getGroupTransactionHistory(groupId);
    return {
      success: true,
      data: transactions,
      meta: {
        total: transactions.length,
      },
    };
  }
}

