import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SystemSettingsService } from '../system-settings/system-settings.service.js';
import { NotificationsService } from '../../integrations/notifications/notifications.service.js';
import { AcceptanceProcessor } from '../../queue/acceptance.processor.js';
import { Bid, BidStatus, JobStatus, OperatorApprovalStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { CreateBidDto } from './dto/create-bid.dto.js';

@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly acceptanceProcessor: AcceptanceProcessor,
  ) {}

  async create(operatorId: string, createBidDto: CreateBidDto): Promise<Bid> {
    // Verify operator exists and is approved
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { documents: true },
    });

    if (!operator) {
      throw new NotFoundException('Operator profile not found');
    }

    if (operator.approvalStatus !== OperatorApprovalStatus.APPROVED) {
      throw new BadRequestException('Operator must be approved to submit bids');
    }

    // Verify operator has valid (non-expired) license and insurance documents
    const now = new Date();
    const licenseDoc = operator.documents.find(
      (doc) => doc.documentType === 'OPERATING_LICENSE',
    );
    const insuranceDoc = operator.documents.find(
      (doc) => doc.documentType === 'INSURANCE',
    );

    if (!licenseDoc) {
      throw new BadRequestException('Operating license document is required to submit bids');
    }
    if (licenseDoc.expiresAt && licenseDoc.expiresAt < now) {
      throw new BadRequestException('Operating license has expired. Please upload a valid license.');
    }

    if (!insuranceDoc) {
      throw new BadRequestException('Insurance document is required to submit bids');
    }
    if (insuranceDoc.expiresAt && insuranceDoc.expiresAt < now) {
      throw new BadRequestException('Insurance has expired. Please upload a valid insurance document.');
    }

    // Verify job exists and is open for bidding
    const job = await this.prisma.job.findUnique({
      where: { id: createBidDto.jobId },
      include: { booking: true },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.OPEN_FOR_BIDDING) {
      throw new BadRequestException('Job is not open for bidding');
    }

    if (new Date() > job.biddingWindowClosesAt) {
      throw new BadRequestException('Bidding window has closed');
    }

    // Verify operator has declared capability for the required vehicle type
    const requiredVehicleType = job.booking.vehicleType;
    const canServiceVehicleType = operator.vehicleTypes.includes(requiredVehicleType);
    if (!canServiceVehicleType) {
      throw new BadRequestException(
        `You are not registered to service ${requiredVehicleType} vehicles. Please update your vehicle types in your profile.`,
      );
    }

    // Verify bid amount doesn't exceed customer price
    const bidAmount = new Prisma.Decimal(createBidDto.bidAmount);
    if (bidAmount.gt(job.booking.customerPrice)) {
      throw new BadRequestException('Bid amount cannot exceed customer price');
    }

    // Verify bid amount meets minimum percentage threshold
    const minBidPercent = await this.systemSettingsService.getSettingOrDefault('MIN_BID_PERCENT', 50);
    const minimumBidAmount = job.booking.customerPrice.mul(minBidPercent).div(100);
    if (bidAmount.lt(minimumBidAmount)) {
      throw new BadRequestException(
        `Bid amount must be at least ${minBidPercent}% of customer price (minimum: £${minimumBidAmount.toFixed(2)})`,
      );
    }

    // Check if operator already bid on this job
    const existingBid = await this.prisma.bid.findFirst({
      where: {
        jobId: createBidDto.jobId,
        operatorId,
      },
    });

    if (existingBid) {
      // Update existing bid
      this.logger.log(`Operator ${operatorId} updated bid on job ${createBidDto.jobId}`);
      return this.prisma.bid.update({
        where: { id: existingBid.id },
        data: {
          bidAmount,
          notes: createBidDto.notes || existingBid.notes,
        },
      });
    }

    // Create new bid
    this.logger.log(`Operator ${operatorId} submitted new bid on job ${createBidDto.jobId}`);
    return this.prisma.bid.create({
      data: {
        jobId: createBidDto.jobId,
        operatorId,
        bidAmount,
        notes: createBidDto.notes || null,
        status: BidStatus.PENDING,
      },
    });
  }

  async findJobBids(jobId: string): Promise<Bid[]> {
    return this.prisma.bid.findMany({
      where: { jobId },
      orderBy: [{ bidAmount: 'asc' }, { submittedAt: 'asc' }],
      include: {
        operator: {
          select: {
            id: true,
            companyName: true,
            reputationScore: true,
            completedJobs: true,
          },
        },
      },
    });
  }

  async findOne(id: string): Promise<Bid> {
    const bid = await this.prisma.bid.findUnique({
      where: { id },
      include: {
        operator: true,
        job: {
          include: { booking: true },
        },
      },
    });

    if (!bid) {
      throw new NotFoundException(`Bid with ID ${id} not found`);
    }

    return bid;
  }

  async findOperatorBids(operatorId: string): Promise<Bid[]> {
    return this.prisma.bid.findMany({
      where: { operatorId },
      orderBy: { submittedAt: 'desc' },
      include: {
        job: {
          include: {
            booking: {
              select: {
                bookingReference: true,
                pickupAddress: true,
                dropoffAddress: true,
                pickupDatetime: true,
                customerPrice: true,
                vehicleType: true,
              },
            },
          },
        },
      },
    });
  }

  async withdrawBid(bidId: string, operatorId: string): Promise<Bid> {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: { job: true },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    if (bid.operatorId !== operatorId) {
      throw new BadRequestException('You can only withdraw your own bids');
    }

    if (bid.status !== BidStatus.PENDING) {
      throw new BadRequestException('Can only withdraw pending bids');
    }

    if (bid.job.status !== JobStatus.OPEN_FOR_BIDDING) {
      throw new BadRequestException('Cannot withdraw bid - job is no longer open for bidding');
    }

    this.logger.log(`Operator ${operatorId} withdrew bid ${bidId}`);

    return this.prisma.bid.update({
      where: { id: bidId },
      data: { status: BidStatus.WITHDRAWN },
    });
  }

  async updateStatus(id: string, status: BidStatus): Promise<Bid> {
    return this.prisma.bid.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Accept a job offer by bid ID
   */
  async acceptJobOffer(bidId: string, operatorId: string) {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        job: {
          include: {
            booking: true,
          },
        },
      },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    if (bid.operatorId !== operatorId) {
      throw new ForbiddenException('You can only accept your own bids');
    }

    const job = bid.job;

    // Verify job is pending acceptance and this bid is the current offer
    if (job.status !== JobStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException('This job is not pending acceptance');
    }

    if (job.currentOfferedBidId !== bidId) {
      throw new ForbiddenException('This bid is not the current offer for this job');
    }

    // Check if acceptance window has expired
    if (job.acceptanceWindowClosesAt && new Date() > job.acceptanceWindowClosesAt) {
      throw new BadRequestException('Acceptance window has expired');
    }

    // Calculate platform margin
    const customerPrice = new Decimal(job.booking.customerPrice.toString());
    const winningBidAmount = new Decimal(bid.bidAmount.toString());
    const platformMargin = customerPrice.minus(winningBidAmount);

    // Accept the job - update status to ASSIGNED
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.ASSIGNED,
          assignedOperatorId: operatorId,
          winningBidId: bid.id,
          platformMargin: platformMargin,
          currentOfferedBidId: null,
          acceptanceWindowOpensAt: null,
          acceptanceWindowClosesAt: null,
        },
      }),
      this.prisma.bid.update({
        where: { id: bid.id },
        data: {
          status: BidStatus.WON,
          respondedAt: new Date(),
        },
      }),
      // Mark all other bids as LOST
      this.prisma.bid.updateMany({
        where: {
          jobId: job.id,
          id: { not: bid.id },
          status: { in: [BidStatus.PENDING, BidStatus.OFFERED] },
        },
        data: { status: BidStatus.LOST },
      }),
      this.prisma.booking.update({
        where: { id: job.bookingId },
        data: { status: 'ASSIGNED' },
      }),
    ]);

    this.logger.log(`Operator ${operatorId} accepted job ${job.id} via bid ${bidId}`);

    // Send bid won notification
    await this.notificationsService.sendBidWonNotification({
      operatorId: operatorId,
      bookingReference: job.booking.bookingReference,
      pickupAddress: job.booking.pickupAddress,
      dropoffAddress: job.booking.dropoffAddress,
      pickupDatetime: job.booking.pickupDatetime,
      bidAmount: `£${winningBidAmount.toFixed(2)}`,
    });

    return {
      jobId: job.id,
      bidId: bid.id,
      bookingReference: job.booking.bookingReference,
      status: 'ASSIGNED',
      bidAmount: winningBidAmount.toFixed(2),
    };
  }

  /**
   * Decline a job offer by bid ID
   */
  async declineJobOffer(bidId: string, operatorId: string) {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        job: {
          include: {
            booking: true,
          },
        },
      },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    if (bid.operatorId !== operatorId) {
      throw new ForbiddenException('You can only decline your own bids');
    }

    const job = bid.job;

    // Verify job is pending acceptance and this bid is the current offer
    if (job.status !== JobStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException('This job is not pending acceptance');
    }

    if (job.currentOfferedBidId !== bidId) {
      throw new ForbiddenException('This bid is not the current offer for this job');
    }

    // Mark bid as DECLINED
    await this.prisma.bid.update({
      where: { id: bid.id },
      data: {
        status: BidStatus.DECLINED,
        respondedAt: new Date(),
      },
    });

    this.logger.log(`Operator ${operatorId} declined job ${job.id} via bid ${bidId}`);

    // Offer to next bidder
    await this.acceptanceProcessor.offerToNextBidder(
      { ...job, booking: job.booking },
      job.acceptanceAttemptCount || 1,
    );

    return {
      jobId: job.id,
      bidId: bid.id,
      bookingReference: job.booking.bookingReference,
      status: 'DECLINED',
      message: 'Job declined and offered to next bidder',
    };
  }
}

