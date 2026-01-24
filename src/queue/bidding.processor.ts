import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../integrations/notifications/notifications.service.js';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service.js';
import { JobStatus, BidStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BIDDING_QUEUE, ACCEPTANCE_QUEUE } from './queue.module.js';

export interface CloseBiddingJobData {
  jobId: string;
}

@Processor(BIDDING_QUEUE)
export class BiddingProcessor extends WorkerHost {
  private readonly logger = new Logger(BiddingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly systemSettingsService: SystemSettingsService,
    @InjectQueue(ACCEPTANCE_QUEUE) private readonly acceptanceQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<CloseBiddingJobData>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`Processing bidding window closure for job ${jobId}`);

    try {
      await this.closeBiddingAndAssignWinner(jobId);
    } catch (error) {
      this.logger.error(`Failed to process job ${jobId}:`, error);
      throw error;
    }
  }

  private async closeBiddingAndAssignWinner(jobId: string): Promise<void> {
    const jobRecord = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        booking: true,
        bids: {
          where: { status: BidStatus.PENDING },
          orderBy: [
            { bidAmount: 'asc' },
            { submittedAt: 'asc' },
          ],
          include: {
            operator: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!jobRecord) {
      this.logger.warn(`Job ${jobId} not found`);
      return;
    }

    // Skip if already processed
    if (jobRecord.status !== JobStatus.OPEN_FOR_BIDDING) {
      this.logger.log(`Job ${jobId} already processed (status: ${jobRecord.status})`);
      return;
    }

    // No bids received
    if (jobRecord.bids.length === 0) {
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.NO_BIDS_RECEIVED },
      });
      this.logger.warn(`Job ${jobId} closed with no bids - escalating to admin`);

      // Send escalation notification to admin
      await this.notificationsService.sendJobEscalationToAdmin({
        jobId,
        bookingReference: jobRecord.booking.bookingReference,
        pickupAddress: jobRecord.booking.pickupAddress,
        dropoffAddress: jobRecord.booking.dropoffAddress,
        pickupDatetime: jobRecord.booking.pickupDatetime,
        vehicleType: jobRecord.booking.vehicleType,
        customerPrice: jobRecord.booking.customerPrice.toString(),
        reason: 'NO_BIDS_RECEIVED',
      });

      return;
    }

    // Get lowest bid to offer first
    const lowestBid = jobRecord.bids[0];
    const winningBidAmount = new Decimal(lowestBid.bidAmount.toString());

    // Get acceptance window duration from settings
    const acceptanceMinutes = await this.systemSettingsService.getSettingOrDefault(
      'ACCEPTANCE_WINDOW_MINUTES',
      30,
    );

    const now = new Date();
    const acceptanceDeadline = new Date(now.getTime() + acceptanceMinutes * 60 * 1000);

    // Use transaction to update job and bid status
    await this.prisma.$transaction([
      // Update job to PENDING_ACCEPTANCE (not directly ASSIGNED)
      this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.PENDING_ACCEPTANCE,
          currentOfferedBidId: lowestBid.id,
          acceptanceWindowOpensAt: now,
          acceptanceWindowClosesAt: acceptanceDeadline,
          acceptanceAttemptCount: 1,
        },
      }),
      // Mark lowest bid as OFFERED (not WON yet)
      this.prisma.bid.update({
        where: { id: lowestBid.id },
        data: {
          status: BidStatus.OFFERED,
          offeredAt: now,
        },
      }),
    ]);

    this.logger.log(
      `Job ${jobId} offered to operator ${lowestBid.operatorId}. ` +
      `Bid amount: £${winningBidAmount}, Deadline: ${acceptanceDeadline.toISOString()}`,
    );

    // Schedule acceptance timeout job
    await this.acceptanceQueue.add(
      'acceptance-timeout',
      { jobId, bidId: lowestBid.id, attemptNumber: 1 },
      { delay: acceptanceMinutes * 60 * 1000 },
    );

    // Send notification to operator requesting acceptance
    await this.notificationsService.sendJobOfferNotification({
      operatorId: lowestBid.operatorId,
      bookingReference: jobRecord.booking.bookingReference,
      pickupAddress: jobRecord.booking.pickupAddress,
      dropoffAddress: jobRecord.booking.dropoffAddress,
      pickupDatetime: jobRecord.booking.pickupDatetime,
      bidAmount: `£${winningBidAmount.toFixed(2)}`,
      acceptanceDeadline,
    });
  }
}

