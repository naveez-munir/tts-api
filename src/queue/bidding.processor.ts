import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from '../integrations/notifications/notifications.service.js';
import { JobStatus, BidStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BIDDING_QUEUE } from './queue.module.js';

export interface CloseBiddingJobData {
  jobId: string;
}

@Processor(BIDDING_QUEUE)
export class BiddingProcessor extends WorkerHost {
  private readonly logger = new Logger(BiddingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
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
      return;
    }

    // Get lowest bid (winner)
    const winningBid = jobRecord.bids[0];
    const customerPrice = new Decimal(jobRecord.booking.customerPrice.toString());
    const winningBidAmount = new Decimal(winningBid.bidAmount.toString());
    const platformMargin = customerPrice.minus(winningBidAmount);

    // Use transaction to ensure atomicity
    await this.prisma.$transaction([
      // Update job with winner
      this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.ASSIGNED,
          assignedOperatorId: winningBid.operatorId,
          winningBidId: winningBid.id,
          platformMargin: platformMargin,
        },
      }),
      // Mark winning bid as WON
      this.prisma.bid.update({
        where: { id: winningBid.id },
        data: { status: BidStatus.WON },
      }),
      // Mark all other bids as LOST
      this.prisma.bid.updateMany({
        where: {
          jobId,
          id: { not: winningBid.id },
          status: BidStatus.PENDING,
        },
        data: { status: BidStatus.LOST },
      }),
      // Update booking status
      this.prisma.booking.update({
        where: { id: jobRecord.bookingId },
        data: { status: 'ASSIGNED' },
      }),
    ]);

    this.logger.log(
      `Job ${jobId} assigned to operator ${winningBid.operatorId}. ` +
      `Winning bid: £${winningBidAmount}, Margin: £${platformMargin}`,
    );

    // Send notification to winning operator
    await this.notificationsService.sendBidWonNotification({
      operatorId: winningBid.operatorId,
      bookingReference: jobRecord.booking.bookingReference,
      pickupAddress: jobRecord.booking.pickupAddress,
      dropoffAddress: jobRecord.booking.dropoffAddress,
      pickupDatetime: jobRecord.booking.pickupDatetime,
      bidAmount: winningBidAmount.toString(),
    });
  }
}

