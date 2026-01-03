import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Job, JobStatus, JourneyType, BidStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a job from a single booking
   */
  async createFromBooking(bookingId: string, biddingWindowHours: number = 24): Promise<Job> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'PAID') {
      throw new BadRequestException('Booking must be paid before creating a job');
    }

    const existingJob = await this.prisma.job.findUnique({
      where: { bookingId },
    });

    if (existingJob) {
      throw new BadRequestException('Job already exists for this booking');
    }

    const now = new Date();
    const biddingWindowClosesAt = new Date();
    biddingWindowClosesAt.setHours(biddingWindowClosesAt.getHours() + biddingWindowHours);

    const job = await this.prisma.job.create({
      data: {
        bookingId,
        status: JobStatus.OPEN_FOR_BIDDING,
        biddingWindowOpensAt: now,
        biddingWindowClosesAt,
        biddingWindowDurationHours: biddingWindowHours,
      },
      include: {
        booking: true,
      },
    });

    this.logger.log(`Created job ${job.id} for booking ${bookingId} (${booking.journeyType})`);

    return job;
  }

  /**
   * Create jobs for a booking group (return journey)
   * Creates separate jobs for outbound and return legs
   */
  async createFromBookingGroup(
    bookingGroupId: string,
    biddingWindowHours: number = 2,
  ): Promise<{ outboundJob: Job; returnJob: Job }> {
    const bookingGroup = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      include: {
        bookings: {
          orderBy: { journeyType: 'asc' }, // OUTBOUND first, then RETURN
        },
      },
    });

    if (!bookingGroup) {
      throw new NotFoundException('Booking group not found');
    }

    if (bookingGroup.bookings.length !== 2) {
      throw new BadRequestException('Booking group must have exactly 2 bookings');
    }

    const outboundBooking = bookingGroup.bookings.find((b) => b.journeyType === JourneyType.OUTBOUND);
    const returnBooking = bookingGroup.bookings.find((b) => b.journeyType === JourneyType.RETURN);

    if (!outboundBooking || !returnBooking) {
      throw new BadRequestException('Booking group must have both outbound and return bookings');
    }

    // Verify both bookings are paid
    if (outboundBooking.status !== 'PAID' || returnBooking.status !== 'PAID') {
      throw new BadRequestException('Both bookings must be paid before creating jobs');
    }

    // Create jobs for both legs
    const [outboundJob, returnJob] = await Promise.all([
      this.createFromBooking(outboundBooking.id, biddingWindowHours),
      this.createFromBooking(returnBooking.id, biddingWindowHours),
    ]);

    this.logger.log(
      `Created jobs for booking group ${bookingGroupId}: outbound=${outboundJob.id}, return=${returnJob.id}`,
    );

    return { outboundJob, returnJob };
  }

  /**
   * Get jobs for a booking group
   */
  async findJobsForBookingGroup(bookingGroupId: string) {
    const bookingGroup = await this.prisma.bookingGroup.findUnique({
      where: { id: bookingGroupId },
      include: {
        bookings: {
          include: {
            job: {
              include: {
                bids: {
                  orderBy: { bidAmount: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!bookingGroup) {
      throw new NotFoundException('Booking group not found');
    }

    return bookingGroup.bookings
      .map((b) => b.job)
      .filter((job) => job !== null);
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        booking: true,
        bids: {
          orderBy: { bidAmount: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async findAvailableJobs(operatorPostcode: string): Promise<Job[]> {
    const now = new Date();
    const postcodePrefix = operatorPostcode.substring(0, 3);

    return this.prisma.job.findMany({
      where: {
        status: JobStatus.OPEN_FOR_BIDDING,
        biddingWindowClosesAt: {
          gt: now,
        },
        booking: {
          OR: [
            // Match by postcode prefix if postcode exists
            {
              pickupPostcode: {
                startsWith: postcodePrefix,
              },
            },
            // Include jobs where pickup postcode is null (show to all operators)
            {
              pickupPostcode: null,
            },
          ],
        },
      },
      include: {
        booking: true,
        bids: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Assign winning bid to a job - lowest bid wins
   * Calculates and stores platform margin (Customer Price - Winning Bid)
   */
  async assignWinningBid(jobId: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        booking: true,
        bids: {
          orderBy: [
            { bidAmount: 'asc' },
            { operator: { reputationScore: 'desc' } }, // Tiebreaker: higher reputation wins
          ],
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== JobStatus.OPEN_FOR_BIDDING && job.status !== JobStatus.BIDDING_CLOSED) {
      throw new BadRequestException('Job is not available for assignment');
    }

    // Get lowest bid (with reputation tiebreaker already applied in query)
    const lowestBid = job.bids[0];

    if (!lowestBid) {
      // No bids received - mark job accordingly
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.NO_BIDS_RECEIVED },
      });
      throw new BadRequestException('No bids received for this job');
    }

    // Calculate platform margin: Customer Price - Winning Bid
    const customerPrice = new Decimal(job.booking.customerPrice.toString());
    const winningBidAmount = new Decimal(lowestBid.bidAmount.toString());
    const platformMargin = customerPrice.minus(winningBidAmount);

    // Use transaction to ensure atomicity
    const [updatedJob] = await this.prisma.$transaction([
      // Update job with winner
      this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.ASSIGNED,
          assignedOperatorId: lowestBid.operatorId,
          winningBidId: lowestBid.id,
          platformMargin: platformMargin,
        },
        include: {
          booking: true,
          bids: true,
          winningBid: true,
          assignedOperator: true,
        },
      }),
      // Mark winning bid as WON
      this.prisma.bid.update({
        where: { id: lowestBid.id },
        data: { status: BidStatus.WON },
      }),
      // Mark all other bids as LOST
      this.prisma.bid.updateMany({
        where: {
          jobId,
          id: { not: lowestBid.id },
          status: BidStatus.PENDING,
        },
        data: { status: BidStatus.LOST },
      }),
      // Update booking status
      this.prisma.booking.update({
        where: { id: job.bookingId },
        data: { status: 'ASSIGNED' },
      }),
    ]);

    this.logger.log(
      `Job ${jobId} assigned to operator ${lowestBid.operatorId}. ` +
        `Winning bid: £${winningBidAmount}, Platform margin: £${platformMargin}`,
    );

    return updatedJob;
  }

  /**
   * Close bidding window and process job
   * Called when bidding window expires
   */
  async closeBiddingWindow(jobId: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { bids: true },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== JobStatus.OPEN_FOR_BIDDING) {
      throw new BadRequestException('Job is not open for bidding');
    }

    // Check if there are any bids
    if (job.bids.length === 0) {
      // No bids - escalate
      const updatedJob = await this.prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.NO_BIDS_RECEIVED },
        include: { booking: true },
      });

      this.logger.warn(`Job ${jobId} received no bids - escalating to admin`);
      return updatedJob;
    }

    // Close bidding and assign winner
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.BIDDING_CLOSED },
    });

    return this.assignWinningBid(jobId);
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { assignedOperator: true },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (job.status !== JobStatus.IN_PROGRESS && job.status !== JobStatus.ASSIGNED) {
      throw new BadRequestException('Job must be in progress or assigned to complete');
    }

    const [updatedJob] = await this.prisma.$transaction([
      // Update job
      this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: { booking: true },
      }),
      // Update booking
      this.prisma.booking.update({
        where: { id: job.bookingId },
        data: { status: 'COMPLETED' },
      }),
      // Update operator stats
      ...(job.assignedOperatorId
        ? [
            this.prisma.operatorProfile.update({
              where: { id: job.assignedOperatorId },
              data: {
                completedJobs: { increment: 1 },
              },
            }),
          ]
        : []),
    ]);

    this.logger.log(`Job ${jobId} completed`);

    return updatedJob;
  }

  async updateStatus(id: string, status: JobStatus): Promise<Job> {
    const updateData: any = { status };

    if (status === JobStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    return this.prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        booking: true,
      },
    });
  }
}

