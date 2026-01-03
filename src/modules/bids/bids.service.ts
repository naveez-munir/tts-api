import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Bid, BidStatus, JobStatus, OperatorApprovalStatus, Prisma } from '@prisma/client';
import type { CreateBidDto } from './dto/create-bid.dto.js';

@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(operatorId: string, createBidDto: CreateBidDto): Promise<Bid> {
    // Verify operator exists and is approved
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      throw new NotFoundException('Operator profile not found');
    }

    if (operator.approvalStatus !== OperatorApprovalStatus.APPROVED) {
      throw new BadRequestException('Operator must be approved to submit bids');
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

    // Verify bid amount doesn't exceed customer price
    const bidAmount = new Prisma.Decimal(createBidDto.bidAmount);
    if (bidAmount.gt(job.booking.customerPrice)) {
      throw new BadRequestException('Bid amount cannot exceed customer price');
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
}

