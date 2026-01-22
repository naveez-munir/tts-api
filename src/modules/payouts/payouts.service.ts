import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SystemSettingsService } from '../system-settings/system-settings.service.js';
import { ResendService } from '../../integrations/resend/resend.service.js';
import { JobStatus, PayoutStatus, TransactionType, TransactionStatus, OperatorApprovalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface OperatorPayoutSummary {
  operatorId: string;
  companyName: string;
  contactEmail: string;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankSortCode: string | null;
  totalAmount: number;
  jobCount: number;
  jobs: Array<{
    id: string;
    bookingReference: string;
    bidAmount: number;
    completedAt: Date;
  }>;
}

export interface PayoutProcessingResult {
  success: boolean;
  processedAt: Date;
  totalOperators: number;
  totalAmount: number;
  operatorPayouts: OperatorPayoutSummary[];
  skippedOperators: Array<{ operatorId: string; reason: string }>;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly resendService: ResendService,
  ) {}

  /**
   * Check if payouts are enabled
   */
  async isPayoutsEnabled(): Promise<boolean> {
    return this.systemSettingsService.getSettingOrDefault('PAYOUTS_ENABLED', true);
  }

  /**
   * Get payout settings
   */
  async getPayoutSettings(): Promise<{
    enabled: boolean;
    initialDelayDays: number;
    frequency: string;
    jobsHeldBack: number;
    payoutDay: number;
    adminEmail: string;
  }> {
    const [enabled, initialDelayDays, frequency, jobsHeldBack, payoutDay, adminEmail] = await Promise.all([
      this.systemSettingsService.getSettingOrDefault('PAYOUTS_ENABLED', true),
      this.systemSettingsService.getSettingOrDefault('INITIAL_PAYOUT_DELAY_DAYS', 14),
      this.systemSettingsService.getSettingOrDefault('PAYOUT_FREQUENCY', 'WEEKLY'),
      this.systemSettingsService.getSettingOrDefault('JOBS_HELD_FOR_NEXT_PAYOUT', 2),
      this.systemSettingsService.getSettingOrDefault('PAYOUT_DAY_OF_WEEK', 5),
      this.systemSettingsService.getSettingOrDefault('ADMIN_PAYOUT_EMAIL', 'admin@example.com'),
    ]);

    return { enabled, initialDelayDays, frequency, jobsHeldBack, payoutDay, adminEmail };
  }

  /**
   * Get eligible jobs for payout for a specific operator
   * Applies the 2-week delay and jobs held back rules
   */
  async getEligibleJobsForOperator(operatorId: string): Promise<any[]> {
    const settings = await this.getPayoutSettings();
    const now = new Date();

    // Calculate the cutoff date (jobs must be completed before this to be eligible)
    const eligibilityCutoff = new Date(now);
    eligibilityCutoff.setDate(eligibilityCutoff.getDate() - settings.initialDelayDays);

    // Get all completed jobs for this operator that haven't been paid out
    const jobs = await this.prisma.job.findMany({
      where: {
        assignedOperatorId: operatorId,
        status: JobStatus.COMPLETED,
        payoutStatus: PayoutStatus.PENDING,
        completedAt: {
          lte: eligibilityCutoff, // Must be completed at least X days ago
        },
      },
      include: {
        booking: {
          select: {
            bookingReference: true,
          },
        },
        winningBid: {
          select: {
            bidAmount: true,
          },
        },
      },
      orderBy: {
        completedAt: 'asc', // Oldest first
      },
    });

    // Apply "jobs held back" rule - exclude the most recent X jobs
    const jobsHeldBack = settings.jobsHeldBack;
    if (jobs.length <= jobsHeldBack) {
      return []; // Not enough jobs to pay out
    }

    // Return all jobs except the last X (most recent ones)
    return jobs.slice(0, jobs.length - jobsHeldBack);
  }

  /**
   * Calculate payout summary for all eligible operators
   */
  async calculatePayoutSummaries(): Promise<{
    operatorPayouts: OperatorPayoutSummary[];
    skippedOperators: Array<{ operatorId: string; companyName: string; reason: string }>;
  }> {
    // Get all approved operators
    const operators = await this.prisma.operatorProfile.findMany({
      where: {
        approvalStatus: OperatorApprovalStatus.APPROVED,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    const operatorPayouts: OperatorPayoutSummary[] = [];
    const skippedOperators: Array<{ operatorId: string; companyName: string; reason: string }> = [];

    for (const operator of operators) {
      // Check if operator has bank details
      if (!operator.bankAccountNumber || !operator.bankSortCode) {
        skippedOperators.push({
          operatorId: operator.id,
          companyName: operator.companyName,
          reason: 'Missing bank details',
        });
        continue;
      }

      // Get eligible jobs
      const eligibleJobs = await this.getEligibleJobsForOperator(operator.id);

      if (eligibleJobs.length === 0) {
        continue; // No eligible jobs, skip silently
      }

      // Calculate total amount
      let totalAmount = new Decimal(0);
      const jobDetails: OperatorPayoutSummary['jobs'] = [];

      for (const job of eligibleJobs) {
        const bidAmount = job.winningBid?.bidAmount || new Decimal(0);
        totalAmount = totalAmount.add(bidAmount);
        jobDetails.push({
          id: job.id,
          bookingReference: job.booking.bookingReference,
          bidAmount: Number(bidAmount),
          completedAt: job.completedAt!,
        });
      }

      operatorPayouts.push({
        operatorId: operator.id,
        companyName: operator.companyName,
        contactEmail: operator.user.email,
        bankAccountName: operator.bankAccountName,
        bankAccountNumber: operator.bankAccountNumber,
        bankSortCode: operator.bankSortCode,
        totalAmount: Number(totalAmount),
        jobCount: eligibleJobs.length,
        jobs: jobDetails,
      });
    }

    return { operatorPayouts, skippedOperators };
  }

  /**
   * Mark jobs as processing (called when admin email is sent)
   */
  async markJobsAsProcessing(jobIds: string[]): Promise<void> {
    await this.prisma.job.updateMany({
      where: {
        id: { in: jobIds },
      },
      data: {
        payoutStatus: PayoutStatus.PROCESSING,
      },
    });

    this.logger.log(`Marked ${jobIds.length} jobs as PROCESSING`);
  }

  /**
   * Complete payout for an operator (called by admin after bank transfer)
   */
  async completePayout(
    operatorId: string,
    jobIds: string[],
    adminUserId: string,
    bankReference?: string,
  ): Promise<{ transactionId: string; totalAmount: number }> {
    // Verify jobs belong to operator and are in PROCESSING status
    const jobs = await this.prisma.job.findMany({
      where: {
        id: { in: jobIds },
        assignedOperatorId: operatorId,
        payoutStatus: PayoutStatus.PROCESSING,
      },
      include: {
        winningBid: true,
        booking: true,
      },
    });

    if (jobs.length !== jobIds.length) {
      throw new NotFoundException('Some jobs not found or not in PROCESSING status');
    }

    // Calculate total amount
    let totalAmount = new Decimal(0);
    for (const job of jobs) {
      totalAmount = totalAmount.add(job.winningBid?.bidAmount || 0);
    }

    // Get operator details
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    // Create transaction record
    const transaction = await this.prisma.transaction.create({
      data: {
        bookingId: jobs[0].bookingId, // Link to first booking (for reference)
        transactionType: TransactionType.OPERATOR_PAYOUT,
        amount: totalAmount,
        status: TransactionStatus.COMPLETED,
        stripePaymentIntentId: bankReference || `MANUAL-${Date.now()}`,
        metadata: {
          operatorId,
          companyName: operator.companyName,
          jobIds,
          jobCount: jobs.length,
          bankReference,
          processedBy: adminUserId,
        },
      },
    });

    // Update all jobs
    const now = new Date();
    await this.prisma.job.updateMany({
      where: {
        id: { in: jobIds },
      },
      data: {
        payoutStatus: PayoutStatus.COMPLETED,
        payoutProcessedAt: now,
        payoutTransactionId: transaction.id,
      },
    });

    this.logger.log(
      `Completed payout for operator ${operator.companyName}: £${totalAmount.toFixed(2)} for ${jobs.length} jobs`,
    );

    // Send notification email to operator
    await this.sendOperatorPayoutNotification(
      operator.user.email,
      operator.companyName,
      Number(totalAmount),
      jobs.length,
      jobs.map(j => ({
        bookingReference: j.booking.bookingReference,
        bidAmount: Number(j.winningBid?.bidAmount || 0),
        completedAt: j.completedAt || j.updatedAt,
      })),
      bankReference,
    );

    return {
      transactionId: transaction.id,
      totalAmount: Number(totalAmount),
    };
  }

  /**
   * Send payout completed notification to operator
   */
  private async sendOperatorPayoutNotification(
    email: string,
    companyName: string,
    totalAmount: number,
    jobCount: number,
    jobs: Array<{ bookingReference: string; bidAmount: number; completedAt: Date }>,
    bankReference?: string,
  ): Promise<void> {
    const jobRows = jobs.map(j => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; font-family: monospace;">${j.bookingReference}</td>
        <td style="padding: 10px; text-align: right;">£${j.bidAmount.toFixed(2)}</td>
        <td style="padding: 10px;">${new Date(j.completedAt).toLocaleDateString('en-GB')}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">💰 Payout Completed</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Your payment has been processed</p>
        </div>

        <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px 0;">Hello <strong>${companyName}</strong>,</p>

          <p style="margin: 0 0 24px 0;">
            Great news! Your payout of <strong style="color: #059669; font-size: 20px;">£${totalAmount.toFixed(2)}</strong>
            has been processed and sent to your registered bank account.
          </p>

          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <table style="width: 100%; margin-bottom: 8px;">
              <tr>
                <td style="color: #6b7280;">Jobs Covered:</td>
                <td style="font-weight: 600; text-align: right;">${jobCount}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Total Amount:</td>
                <td style="font-weight: 600; text-align: right; color: #059669;">£${totalAmount.toFixed(2)}</td>
              </tr>
              ${bankReference ? `
              <tr>
                <td style="color: #6b7280;">Bank Reference:</td>
                <td style="font-weight: 600; text-align: right; font-family: monospace;">${bankReference}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <h3 style="margin: 0 0 12px 0; color: #111827;">Jobs Included</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 10px; text-align: left;">Booking Ref</th>
                <th style="padding: 10px; text-align: right;">Amount</th>
                <th style="padding: 10px; text-align: left;">Completed</th>
              </tr>
            </thead>
            <tbody>
              ${jobRows}
            </tbody>
          </table>

          <div style="margin-top: 24px; padding: 16px; background-color: #dbeafe; border-radius: 8px;">
            <p style="margin: 0; color: #1e40af;">
              Funds should appear in your account within 1-3 business days.
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      </div>
    `;

    await this.resendService.sendEmail({
      to: email,
      subject: `💰 Payout Completed - £${totalAmount.toFixed(2)} for ${jobCount} jobs`,
      html,
    });

    this.logger.log(`Payout notification sent to ${email}`);
  }

  /**
   * Get pending payouts for admin view
   */
  async getPendingPayouts(): Promise<OperatorPayoutSummary[]> {
    const { operatorPayouts } = await this.calculatePayoutSummaries();
    return operatorPayouts;
  }

  /**
   * Get processing payouts (waiting for admin to complete)
   */
  async getProcessingPayouts(): Promise<any[]> {
    // Get jobs that are in PROCESSING status, grouped by operator
    const jobs = await this.prisma.job.findMany({
      where: {
        payoutStatus: PayoutStatus.PROCESSING,
      },
      include: {
        booking: {
          select: { bookingReference: true },
        },
        winningBid: {
          select: { bidAmount: true },
        },
        assignedOperator: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
      orderBy: {
        assignedOperatorId: 'asc',
      },
    });

    // Group by operator
    const grouped: Record<string, any> = {};
    for (const job of jobs) {
      const opId = job.assignedOperatorId!;
      if (!grouped[opId]) {
        grouped[opId] = {
          operatorId: opId,
          companyName: job.assignedOperator?.companyName,
          contactEmail: job.assignedOperator?.user.email,
          bankAccountName: job.assignedOperator?.bankAccountName,
          bankAccountNumber: job.assignedOperator?.bankAccountNumber,
          bankSortCode: job.assignedOperator?.bankSortCode,
          totalAmount: 0,
          jobCount: 0,
          jobs: [],
        };
      }
      const bidAmount = Number(job.winningBid?.bidAmount || 0);
      grouped[opId].totalAmount += bidAmount;
      grouped[opId].jobCount += 1;
      grouped[opId].jobs.push({
        id: job.id,
        bookingReference: job.booking.bookingReference,
        bidAmount,
        completedAt: job.completedAt,
      });
    }

    return Object.values(grouped);
  }

  /**
   * Get operator's earnings summary
   */
  async getOperatorEarnings(operatorId: string): Promise<{
    totalEarnings: number;
    pendingPayouts: number;
    completedPayouts: number;
    processingPayouts: number;
  }> {
    // Get all completed jobs for this operator
    const jobs = await this.prisma.job.findMany({
      where: {
        assignedOperatorId: operatorId,
        status: JobStatus.COMPLETED,
      },
      include: {
        winningBid: {
          select: { bidAmount: true },
        },
      },
    });

    let totalEarnings = 0;
    let pendingPayouts = 0;
    let completedPayouts = 0;
    let processingPayouts = 0;

    for (const job of jobs) {
      const bidAmount = Number(job.winningBid?.bidAmount || 0);
      totalEarnings += bidAmount;

      switch (job.payoutStatus) {
        case PayoutStatus.PENDING:
        case PayoutStatus.NOT_ELIGIBLE:
          pendingPayouts += bidAmount;
          break;
        case PayoutStatus.PROCESSING:
          processingPayouts += bidAmount;
          break;
        case PayoutStatus.COMPLETED:
          completedPayouts += bidAmount;
          break;
      }
    }

    return {
      totalEarnings,
      pendingPayouts,
      completedPayouts,
      processingPayouts,
    };
  }
}

