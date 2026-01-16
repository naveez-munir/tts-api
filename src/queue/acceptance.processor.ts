import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../integrations/notifications/notifications.service.js';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service.js';
import { JobStatus, BidStatus } from '@prisma/client';
import { ACCEPTANCE_QUEUE } from './queue.module.js';

export interface AcceptanceTimeoutJobData {
  jobId: string;
  bidId: string;
  attemptNumber: number;
}

@Processor(ACCEPTANCE_QUEUE)
export class AcceptanceProcessor extends WorkerHost {
  private readonly logger = new Logger(AcceptanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly systemSettingsService: SystemSettingsService,
    @InjectQueue(ACCEPTANCE_QUEUE) private readonly acceptanceQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<AcceptanceTimeoutJobData>): Promise<void> {
    const { jobId, bidId, attemptNumber } = job.data;
    this.logger.log(`Processing acceptance timeout for job ${jobId}, bid ${bidId}, attempt ${attemptNumber}`);

    try {
      await this.handleAcceptanceTimeout(jobId, bidId, attemptNumber);
    } catch (error) {
      this.logger.error(`Failed to process acceptance timeout for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Handle when an operator doesn't respond within the acceptance window
   */
  private async handleAcceptanceTimeout(jobId: string, bidId: string, attemptNumber: number): Promise<void> {
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
            operator: { include: { user: true } },
          },
        },
      },
    });

    if (!jobRecord) {
      this.logger.warn(`Job ${jobId} not found`);
      return;
    }

    // Check if job is still pending acceptance (operator might have already responded)
    if (jobRecord.status !== JobStatus.PENDING_ACCEPTANCE) {
      this.logger.log(`Job ${jobId} no longer pending acceptance (status: ${jobRecord.status})`);
      return;
    }

    // Check if this is still the current offered bid
    if (jobRecord.currentOfferedBidId !== bidId) {
      this.logger.log(`Bid ${bidId} is no longer the current offer for job ${jobId}`);
      return;
    }

    // Mark current bid as DECLINED (timeout)
    await this.prisma.bid.update({
      where: { id: bidId },
      data: {
        status: BidStatus.DECLINED,
        respondedAt: new Date(),
      },
    });

    this.logger.log(`Bid ${bidId} marked as DECLINED due to timeout`);

    // Try to offer to next bidder
    await this.offerToNextBidder(jobRecord, attemptNumber);
  }

  /**
   * Offer job to the next lowest bidder
   */
  async offerToNextBidder(
    jobRecord: any,
    currentAttempt: number,
  ): Promise<void> {
    // Get next available bid (PENDING status, ordered by amount)
    const nextBid = await this.prisma.bid.findFirst({
      where: {
        jobId: jobRecord.id,
        status: BidStatus.PENDING,
      },
      orderBy: [
        { bidAmount: 'asc' },
        { submittedAt: 'asc' },
      ],
      include: {
        operator: { include: { user: true } },
      },
    });

    if (!nextBid) {
      // No more bidders - escalate to admin
      await this.prisma.job.update({
        where: { id: jobRecord.id },
        data: {
          status: JobStatus.NO_BIDS_RECEIVED, // Reuse this status for "no acceptance"
          currentOfferedBidId: null,
        },
      });
      this.logger.warn(`Job ${jobRecord.id} - no more bidders available, escalating to admin`);

      // Send escalation notification to admin
      await this.notificationsService.sendJobEscalationToAdmin({
        jobId: jobRecord.id,
        bookingReference: jobRecord.booking.bookingReference,
        pickupAddress: jobRecord.booking.pickupAddress,
        dropoffAddress: jobRecord.booking.dropoffAddress,
        pickupDatetime: jobRecord.booking.pickupDatetime,
        vehicleType: jobRecord.booking.vehicleType,
        customerPrice: jobRecord.booking.customerPrice.toString(),
        reason: 'ALL_OPERATORS_REJECTED',
      });

      return;
    }

    // Get acceptance window duration from settings
    const acceptanceMinutes = await this.systemSettingsService.getSettingOrDefault(
      'ACCEPTANCE_WINDOW_MINUTES',
      30,
    );

    const now = new Date();
    const acceptanceDeadline = new Date(now.getTime() + acceptanceMinutes * 60 * 1000);

    // Update job and bid
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: jobRecord.id },
        data: {
          currentOfferedBidId: nextBid.id,
          acceptanceWindowOpensAt: now,
          acceptanceWindowClosesAt: acceptanceDeadline,
          acceptanceAttemptCount: currentAttempt + 1,
        },
      }),
      this.prisma.bid.update({
        where: { id: nextBid.id },
        data: {
          status: BidStatus.OFFERED,
          offeredAt: now,
        },
      }),
    ]);

    // Schedule timeout job
    await this.scheduleAcceptanceTimeout(jobRecord.id, nextBid.id, currentAttempt + 1, acceptanceMinutes);

    // Notify the operator
    const booking = jobRecord.booking;
    await this.notificationsService.sendJobOfferNotification({
      operatorId: nextBid.operatorId,
      bookingReference: booking.bookingReference,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupDatetime: booking.pickupDatetime,
      bidAmount: nextBid.bidAmount.toString(),
      acceptanceDeadline,
    });

    this.logger.log(
      `Job ${jobRecord.id} offered to operator ${nextBid.operatorId} (attempt ${currentAttempt + 1}), ` +
      `deadline: ${acceptanceDeadline.toISOString()}`,
    );
  }

  /**
   * Schedule a timeout job for acceptance window
   */
  async scheduleAcceptanceTimeout(
    jobId: string,
    bidId: string,
    attemptNumber: number,
    delayMinutes: number,
  ): Promise<void> {
    await this.acceptanceQueue.add(
      'acceptance-timeout',
      { jobId, bidId, attemptNumber },
      { delay: delayMinutes * 60 * 1000 },
    );
  }
}

