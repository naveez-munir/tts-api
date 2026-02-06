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
   * Get payouts forecast - shows ALL completed jobs with eligibility status
   * This gives admin visibility into: eligible now, pending (in hold period), and held back jobs
   */
  async getPayoutsForecast(): Promise<any[]> {
    const settings = await this.getPayoutSettings();
    const now = new Date();
    const eligibilityCutoff = new Date(now);
    eligibilityCutoff.setDate(eligibilityCutoff.getDate() - settings.initialDelayDays);

    // Get all operators
    const operators = await this.prisma.operatorProfile.findMany({
      where: {
        approvalStatus: OperatorApprovalStatus.APPROVED,
      },
      include: {
        user: { select: { email: true } },
      },
    });

    const forecast: any[] = [];

    for (const operator of operators) {
      // Get ALL completed jobs that haven't been paid out yet
      const allJobs = await this.prisma.job.findMany({
        where: {
          assignedOperatorId: operator.id,
          status: JobStatus.COMPLETED,
          payoutStatus: {
            notIn: [PayoutStatus.PROCESSING, PayoutStatus.COMPLETED],
          },
        },
        include: {
          booking: { select: { bookingReference: true } },
          winningBid: { select: { bidAmount: true } },
        },
        orderBy: { completedAt: 'asc' },
      });

      if (allJobs.length === 0) continue;

      // Categorize jobs
      const eligibleJobs: any[] = [];
      const pendingJobs: any[] = []; // Within 14-day hold
      const heldBackJobs: any[] = []; // Last 2 jobs

      // Determine which jobs are held back (last X jobs)
      const jobsHeldBackCount = Math.min(settings.jobsHeldBack, allJobs.length);
      const heldBackIds = new Set(
        allJobs.slice(-jobsHeldBackCount).map(j => j.id)
      );

      for (const job of allJobs) {
        const bidAmount = Number(job.winningBid?.bidAmount || 0);
        const jobData = {
          id: job.id,
          bookingReference: job.booking.bookingReference,
          bidAmount,
          completedAt: job.completedAt!,
        };

        if (heldBackIds.has(job.id)) {
          heldBackJobs.push(jobData);
          continue;
        }

        if (job.completedAt && job.completedAt <= eligibilityCutoff) {
          eligibleJobs.push(jobData);
        } else if (job.completedAt) {
          const eligibleDate = new Date(job.completedAt);
          eligibleDate.setDate(eligibleDate.getDate() + settings.initialDelayDays);
          const daysRemaining = Math.ceil(
            (eligibleDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          pendingJobs.push({
            ...jobData,
            eligibleDate,
            daysRemaining,
          });
        }
      }

      const totalEligible = eligibleJobs.reduce((sum, j) => sum + j.bidAmount, 0);
      const totalPending = pendingJobs.reduce((sum, j) => sum + j.bidAmount, 0);
      const totalHeldBack = heldBackJobs.reduce((sum, j) => sum + j.bidAmount, 0);

      const allJobsSorted = [...eligibleJobs, ...pendingJobs, ...heldBackJobs].sort(
        (a: any, b: any) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
      );
      const earliestJobDate = allJobsSorted.length > 0 ? allJobsSorted[0].completedAt : null;

      forecast.push({
        operatorId: operator.id,
        companyName: operator.companyName,
        contactEmail: operator.user.email,
        bankAccountName: operator.bankAccountName,
        bankAccountNumber: operator.bankAccountNumber,
        bankSortCode: operator.bankSortCode,
        summary: {
          totalEligible,
          totalPending,
          totalHeldBack,
          eligibleJobCount: eligibleJobs.length,
          pendingJobCount: pendingJobs.length,
          heldBackJobCount: heldBackJobs.length,
          totalAmount: totalEligible + totalPending + totalHeldBack,
          totalJobCount: allJobs.length,
          earliestJobDate,
        },
        jobs: {
          eligible: eligibleJobs,
          pending: pendingJobs,
          heldBack: heldBackJobs,
        },
      });
    }

    return forecast;
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

  async getOperatorEarnings(
    operatorId: string,
    options?: {
      days?: number;
      from?: Date;
      to?: Date;
      all?: boolean;
    }
  ): Promise<any> {
    const settings = await this.getPayoutSettings();
    const now = new Date();
    const eligibilityCutoff = new Date(now);
    eligibilityCutoff.setDate(eligibilityCutoff.getDate() - settings.initialDelayDays);

    let jobDateFilter = {};
    if (!options?.all) {
      const daysBack = options?.days || 14;
      const dateFrom = options?.from || new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      const dateTo = options?.to || now;

      jobDateFilter = {
        completedAt: {
          gte: dateFrom,
          lte: dateTo
        }
      };
    }

    const [unpaidJobsInRange, unpaidJobsSummary, paidOutTotal, processingTotal, bankDetails] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          assignedOperatorId: operatorId,
          status: JobStatus.COMPLETED,
          payoutStatus: {
            in: [PayoutStatus.PENDING, PayoutStatus.NOT_ELIGIBLE]
          },
          ...jobDateFilter
        },
        select: {
          id: true,
          completedAt: true,
          payoutStatus: true,
          winningBid: {
            select: { bidAmount: true }
          },
          booking: {
            select: {
              bookingReference: true,
              pickupAddress: true,
              dropoffAddress: true
            }
          }
        },
        orderBy: { completedAt: 'desc' }
      }),

      this.prisma.job.findMany({
        where: {
          assignedOperatorId: operatorId,
          status: JobStatus.COMPLETED,
          payoutStatus: {
            in: [PayoutStatus.PENDING, PayoutStatus.NOT_ELIGIBLE]
          }
        },
        select: {
          id: true,
          completedAt: true,
          winningBid: {
            select: { bidAmount: true }
          }
        },
        orderBy: { completedAt: 'asc' }
      }),

      this.prisma.job.aggregate({
        where: {
          assignedOperatorId: operatorId,
          status: JobStatus.COMPLETED,
          payoutStatus: PayoutStatus.COMPLETED
        },
        _sum: {
          platformMargin: true
        },
        _count: true
      }),

      this.prisma.job.aggregate({
        where: {
          assignedOperatorId: operatorId,
          status: JobStatus.COMPLETED,
          payoutStatus: PayoutStatus.PROCESSING
        },
        _sum: {
          platformMargin: true
        }
      }),

      this.prisma.operatorProfile.findUnique({
        where: { id: operatorId },
        select: {
          bankAccountName: true,
          bankAccountNumber: true,
          bankSortCode: true
        }
      })
    ]);

    const jobsHeldBackCount = Math.min(settings.jobsHeldBack, unpaidJobsSummary.length);
    const heldBackIds = new Set(
      unpaidJobsSummary.slice(-jobsHeldBackCount).map(j => j.id)
    );

    let eligibleTotal = 0;
    let inHoldTotal = 0;
    let heldBackTotal = 0;

    for (const job of unpaidJobsSummary) {
      const bidAmount = Number(job.winningBid?.bidAmount || 0);

      if (heldBackIds.has(job.id)) {
        heldBackTotal += bidAmount;
      } else if (job.completedAt && job.completedAt <= eligibilityCutoff) {
        eligibleTotal += bidAmount;
      } else {
        inHoldTotal += bidAmount;
      }
    }

    const eligible: any[] = [];
    const inHold: any[] = [];
    const heldBack: any[] = [];

    for (const job of unpaidJobsInRange) {
      const bidAmount = Number(job.winningBid?.bidAmount || 0);

      const jobData = {
        id: job.id,
        bookingReference: job.booking.bookingReference,
        pickupAddress: job.booking.pickupAddress,
        dropoffAddress: job.booking.dropoffAddress,
        completedAt: job.completedAt,
        bidAmount
      };

      if (heldBackIds.has(job.id)) {
        heldBack.push({ ...jobData, status: 'HELD_BACK' });
      } else if (job.completedAt && job.completedAt <= eligibilityCutoff) {
        eligible.push({ ...jobData, status: 'ELIGIBLE' });
      } else if (job.completedAt) {
        const eligibleDate = new Date(job.completedAt);
        eligibleDate.setDate(eligibleDate.getDate() + settings.initialDelayDays);
        const daysRemaining = Math.ceil(
          (eligibleDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        inHold.push({
          ...jobData,
          status: 'IN_HOLD',
          daysRemaining,
          eligibleDate
        });
      }
    }

    const totalEarnings = eligibleTotal + inHoldTotal + heldBackTotal;
    const completedPayouts = Number(paidOutTotal._sum.platformMargin || 0);
    const processingPayouts = Number(processingTotal._sum.platformMargin || 0);

    const dateFrom = options?.from || new Date(now.getTime() - ((options?.days || 14) * 24 * 60 * 60 * 1000));
    const dateTo = options?.to || now;

    return {
      summary: {
        totalEarnings,
        completedPayouts,
        processingPayouts,
        pendingBreakdown: {
          eligible: eligibleTotal,
          inHold: inHoldTotal,
          heldBack: heldBackTotal,
          total: totalEarnings
        }
      },

      forecast: {
        eligible: {
          amount: eligible.reduce((sum, j) => sum + j.bidAmount, 0),
          count: eligible.length,
          totalCount: unpaidJobsSummary.filter(j =>
            !heldBackIds.has(j.id) &&
            j.completedAt &&
            j.completedAt <= eligibilityCutoff
          ).length,
          jobs: eligible
        },
        inHold: {
          amount: inHold.reduce((sum, j) => sum + j.bidAmount, 0),
          count: inHold.length,
          totalCount: unpaidJobsSummary.filter(j =>
            !heldBackIds.has(j.id) &&
            j.completedAt &&
            j.completedAt > eligibilityCutoff
          ).length,
          jobs: inHold
        },
        heldBack: {
          amount: heldBack.reduce((sum, j) => sum + j.bidAmount, 0),
          count: heldBack.length,
          totalCount: jobsHeldBackCount,
          jobs: heldBack
        }
      },

      payoutSettings: {
        holdPeriodDays: settings.initialDelayDays,
        jobsHeldBack: settings.jobsHeldBack,
        payoutFrequency: settings.frequency
      },

      bankDetails: {
        isComplete: !!(bankDetails?.bankAccountNumber && bankDetails?.bankSortCode),
        lastFourDigits: bankDetails?.bankAccountNumber?.slice(-4) || null
      },

      meta: {
        dateRange: {
          from: dateFrom,
          to: dateTo,
          days: options?.days || 14,
          isFiltered: !options?.all
        },
        jobsShownInForecast: unpaidJobsInRange.length,
        totalUnpaidJobs: unpaidJobsSummary.length
      }
    };
  }
}

