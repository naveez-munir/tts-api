import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

interface CompletePayoutDto {
  operatorId: string;
  jobIds: string[];
  bankReference?: string;
}

@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutsController {
  constructor(
    private readonly payoutsService: PayoutsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get payout settings (admin only)
   */
  @Get('settings')
  @Roles(UserRole.ADMIN)
  async getSettings() {
    return this.payoutsService.getPayoutSettings();
  }

  /**
   * Get pending payouts - operators with eligible jobs (admin only)
   */
  @Get('pending')
  @Roles(UserRole.ADMIN)
  async getPendingPayouts() {
    const payouts = await this.payoutsService.getPendingPayouts();
    return {
      success: true,
      data: payouts,
      meta: {
        count: payouts.length,
        totalAmount: payouts.reduce((sum, p) => sum + p.totalAmount, 0),
      },
    };
  }

  /**
   * Get payouts forecast - shows ALL completed jobs with eligibility status (admin only)
   * Includes: eligible (ready now), pending (in hold period), held back (last 2 jobs)
   */
  @Get('forecast')
  @Roles(UserRole.ADMIN)
  async getPayoutsForecast() {
    const forecast = await this.payoutsService.getPayoutsForecast();

    const totals = forecast.reduce(
      (acc, op) => ({
        totalEligible: acc.totalEligible + op.summary.totalEligible,
        totalPending: acc.totalPending + op.summary.totalPending,
        totalHeldBack: acc.totalHeldBack + op.summary.totalHeldBack,
        totalAmount: acc.totalAmount + op.summary.totalAmount,
      }),
      { totalEligible: 0, totalPending: 0, totalHeldBack: 0, totalAmount: 0 }
    );

    return {
      success: true,
      data: forecast,
      meta: {
        operatorCount: forecast.length,
        ...totals,
      },
    };
  }

  /**
   * Get processing payouts - waiting for admin to complete (admin only)
   */
  @Get('processing')
  @Roles(UserRole.ADMIN)
  async getProcessingPayouts() {
    const payouts = await this.payoutsService.getProcessingPayouts();
    return {
      success: true,
      data: payouts,
      meta: {
        count: payouts.length,
        totalAmount: payouts.reduce((sum: number, p: any) => sum + p.totalAmount, 0),
      },
    };
  }

  /**
   * Calculate and prepare payouts (admin only)
   * This is called to generate the payout summary
   */
  @Post('calculate')
  @Roles(UserRole.ADMIN)
  async calculatePayouts() {
    const result = await this.payoutsService.calculatePayoutSummaries();
    return {
      success: true,
      data: result,
      meta: {
        operatorCount: result.operatorPayouts.length,
        skippedCount: result.skippedOperators.length,
        totalAmount: result.operatorPayouts.reduce((sum, p) => sum + p.totalAmount, 0),
      },
    };
  }

  /**
   * Mark jobs as processing (admin initiates payout)
   */
  @Post('initiate')
  @Roles(UserRole.ADMIN)
  async initiatePayouts(@Body() body: { operatorId: string; jobIds: string[] }) {
    await this.payoutsService.markJobsAsProcessing(body.jobIds);
    return {
      success: true,
      message: `Marked ${body.jobIds.length} jobs as processing for operator ${body.operatorId}`,
    };
  }

  /**
   * Complete payout after bank transfer (admin only)
   */
  @Post('complete')
  @Roles(UserRole.ADMIN)
  async completePayout(
    @CurrentUser() user: { id: string },
    @Body() dto: CompletePayoutDto,
  ) {
    const result = await this.payoutsService.completePayout(
      dto.operatorId,
      dto.jobIds,
      user.id,
      dto.bankReference,
    );
    return {
      success: true,
      data: result,
      message: `Payout completed: £${result.totalAmount.toFixed(2)}`,
    };
  }

  @Get('my-earnings')
  @Roles(UserRole.OPERATOR)
  async getMyEarnings(
    @CurrentUser() user: { id: string },
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('all') all?: string,
  ) {
    const operatorProfile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!operatorProfile) {
      throw new NotFoundException('Operator profile not found');
    }

    const options = {
      days: days ? parseInt(days, 10) : 14,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      all: all === 'true'
    };

    const earnings = await this.payoutsService.getOperatorEarnings(operatorProfile.id, options);
    return {
      success: true,
      data: earnings,
    };
  }
}

