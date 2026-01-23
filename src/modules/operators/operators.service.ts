import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { OperatorProfile, OperatorApprovalStatus, JobStatus, BidStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { RegisterOperatorDto } from './dto/register-operator.dto.js';
import type { UpdateOperatorProfileDto } from './dto/update-operator-profile.dto.js';
import type { UpdateBankDetailsDto } from './dto/update-bank-details.dto.js';
import type { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto.js';
import { NotificationsService } from '../../integrations/notifications/notifications.service.js';
import { AcceptanceProcessor } from '../../queue/acceptance.processor.js';
import { S3Service } from '../../integrations/s3/s3.service.js';

@Injectable()
export class OperatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly acceptanceProcessor: AcceptanceProcessor,
    private readonly s3Service: S3Service,
  ) {}

  async register(userId: string, registerOperatorDto: RegisterOperatorDto): Promise<OperatorProfile> {
    // Check if operator profile already exists
    const existingProfile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new BadRequestException('Operator profile already exists for this user');
    }

    // Create operator profile with PENDING approval status
    const profile = await this.prisma.operatorProfile.create({
      data: {
        userId,
        companyName: registerOperatorDto.companyName,
        registrationNumber: registerOperatorDto.registrationNumber,
        vatNumber: registerOperatorDto.vatNumber || null,
        approvalStatus: OperatorApprovalStatus.PENDING,
        // Vehicle types operator can service (declaration-based for fast onboarding)
        vehicleTypes: registerOperatorDto.vehicleTypes || [],
        // Operator compliance fields (per data.md requirements)
        operatingLicenseNumber: registerOperatorDto.operatingLicenseNumber || null,
        councilRegistration: registerOperatorDto.councilRegistration || null,
        businessAddress: registerOperatorDto.businessAddress || null,
        businessPostcode: registerOperatorDto.businessPostcode || null,
        emergencyContactName: registerOperatorDto.emergencyContactName || null,
        emergencyContactPhone: registerOperatorDto.emergencyContactPhone || null,
        fleetSize: registerOperatorDto.fleetSize || null,
      },
    });

    // Create service areas
    for (const postcode of registerOperatorDto.serviceAreas) {
      await this.prisma.serviceArea.create({
        data: {
          operatorId: profile.id,
          postcode,
        },
      });
    }

    return profile;
  }

  async findOne(id: string): Promise<OperatorProfile> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { id },
      include: {
        user: true,
        vehicles: true,
        serviceAreas: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }

    return profile;
  }

  async findByUserId(userId: string): Promise<OperatorProfile> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        vehicles: true,
        serviceAreas: true,
        bids: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    return profile;
  }

  async getDashboard(userId: string): Promise<any> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        vehicles: true,
        serviceAreas: true,
        bids: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    // Get stats
    const totalBids = await this.prisma.bid.count({
      where: { operatorId: profile.id },
    });

    const wonBids = await this.prisma.bid.count({
      where: {
        operatorId: profile.id,
        status: 'WON',
      },
    });

    // Use the correct JobStatus enum value
    const availableJobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.OPEN_FOR_BIDDING,
        booking: {
          pickupPostcode: {
            startsWith: profile.serviceAreas[0]?.postcode.substring(0, 3) || '',
          },
        },
      },
    });

    return {
      profile,
      stats: {
        totalBids,
        wonBids,
        availableJobs: availableJobs.length,
        reputationScore: profile.reputationScore,
        totalJobs: profile.totalJobs,
        completedJobs: profile.completedJobs,
        approvalStatus: profile.approvalStatus,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateOperatorProfileDto): Promise<OperatorProfile> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    return this.prisma.operatorProfile.update({
      where: { id: profile.id },
      data: {
        companyName: dto.companyName,
        vatNumber: dto.vatNumber,
        operatingLicenseNumber: dto.operatingLicenseNumber,
        councilRegistration: dto.councilRegistration,
        businessAddress: dto.businessAddress,
        businessPostcode: dto.businessPostcode,
        fleetSize: dto.fleetSize,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        vehicleTypes: dto.vehicleTypes,
      },
    });
  }

  async updateBankDetails(userId: string, dto: UpdateBankDetailsDto): Promise<OperatorProfile> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    return this.prisma.operatorProfile.update({
      where: { id: profile.id },
      data: {
        bankAccountName: dto.bankAccountName,
        bankAccountNumber: dto.bankAccountNumber,
        bankSortCode: dto.bankSortCode,
      },
    });
  }

  async getBankDetails(userId: string): Promise<{ bankAccountName: string | null; bankAccountNumber: string | null; bankSortCode: string | null }> {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
      select: {
        bankAccountName: true,
        bankAccountNumber: true,
        bankSortCode: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    return profile;
  }

  /**
   * Get all documents for an operator with download URLs
   */
  async getDocuments(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    const documents = await this.prisma.document.findMany({
      where: { operatorId: profile.id },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        documentType: true,
        fileName: true,
        fileUrl: true, // S3 key needed to generate download URL
        uploadedAt: true,
        expiresAt: true,
      },
    });

    // Generate presigned download URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const { downloadUrl, expiresIn } = await this.s3Service.generateDownloadUrl(doc.fileUrl);
        return {
          id: doc.id,
          documentType: doc.documentType,
          fileName: doc.fileName,
          fileUrl: downloadUrl, // Replace S3 key with presigned URL
          uploadedAt: doc.uploadedAt,
          expiresAt: doc.expiresAt,
          urlExpiresIn: expiresIn, // Let frontend know when the URL expires
        };
      })
    );

    return documentsWithUrls;
  }

  /**
   * Delete a document
   */
  async deleteDocument(userId: string, documentId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(`Operator profile not found for user ${userId}`);
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document not found`);
    }

    if (document.operatorId !== profile.id) {
      throw new BadRequestException('Not authorized to delete this document');
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    return { deleted: true, documentId };
  }

  /**
   * Accept a job offer by quoting the booking reference
   */
  async acceptJobOffer(userId: string, bookingReference: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    // Find the job by booking reference
    const booking = await this.prisma.booking.findUnique({
      where: { bookingReference },
      include: {
        job: {
          include: {
            bids: {
              where: { operatorId: profile.id },
            },
          },
        },
      },
    });

    if (!booking || !booking.job) {
      throw new NotFoundException('Booking not found');
    }

    const job = booking.job;

    // Verify job is pending acceptance and this operator has the current offer
    if (job.status !== JobStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException('This job is not pending acceptance');
    }

    const operatorBid = job.bids[0];
    if (!operatorBid || job.currentOfferedBidId !== operatorBid.id) {
      throw new ForbiddenException('You do not have an active offer for this job');
    }

    // Check if acceptance window has expired
    if (job.acceptanceWindowClosesAt && new Date() > job.acceptanceWindowClosesAt) {
      throw new BadRequestException('Acceptance window has expired');
    }

    // Calculate platform margin
    const customerPrice = new Decimal(booking.customerPrice.toString());
    const winningBidAmount = new Decimal(operatorBid.bidAmount.toString());
    const platformMargin = customerPrice.minus(winningBidAmount);

    // Accept the job - update status to ASSIGNED
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.ASSIGNED,
          assignedOperatorId: profile.id,
          winningBidId: operatorBid.id,
          platformMargin: platformMargin,
          currentOfferedBidId: null,
          acceptanceWindowOpensAt: null,
          acceptanceWindowClosesAt: null,
        },
      }),
      this.prisma.bid.update({
        where: { id: operatorBid.id },
        data: {
          status: BidStatus.WON,
          respondedAt: new Date(),
        },
      }),
      // Mark all other bids as LOST
      this.prisma.bid.updateMany({
        where: {
          jobId: job.id,
          id: { not: operatorBid.id },
          status: { in: [BidStatus.PENDING, BidStatus.OFFERED] },
        },
        data: { status: BidStatus.LOST },
      }),
      this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'ASSIGNED' },
      }),
    ]);

    // Send bid won notification
    await this.notificationsService.sendBidWonNotification({
      operatorId: profile.id,
      bookingReference: booking.bookingReference,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupDatetime: booking.pickupDatetime,
      bidAmount: `£${winningBidAmount.toFixed(2)}`,
    });

    return {
      jobId: job.id,
      bookingReference,
      status: 'ASSIGNED',
      bidAmount: winningBidAmount.toFixed(2),
    };
  }

  /**
   * Decline a job offer
   */
  async declineJobOffer(userId: string, bookingReference: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    // Find the job by booking reference
    const booking = await this.prisma.booking.findUnique({
      where: { bookingReference },
      include: {
        job: {
          include: {
            bids: {
              where: { operatorId: profile.id },
            },
          },
        },
      },
    });

    if (!booking || !booking.job) {
      throw new NotFoundException('Booking not found');
    }

    const job = booking.job;

    // Verify job is pending acceptance and this operator has the current offer
    if (job.status !== JobStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException('This job is not pending acceptance');
    }

    const operatorBid = job.bids[0];
    if (!operatorBid || job.currentOfferedBidId !== operatorBid.id) {
      throw new ForbiddenException('You do not have an active offer for this job');
    }

    // Mark bid as DECLINED
    await this.prisma.bid.update({
      where: { id: operatorBid.id },
      data: {
        status: BidStatus.DECLINED,
        respondedAt: new Date(),
      },
    });

    // Offer to next bidder
    await this.acceptanceProcessor.offerToNextBidder(
      { ...job, booking },
      job.acceptanceAttemptCount || 1,
    );

    return {
      jobId: job.id,
      bookingReference,
      status: 'DECLINED',
      message: 'Job declined and offered to next bidder',
    };
  }

  /**
   * Get pending job offers for the current operator
   */
  async getPendingJobOffers(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    // Find bids with OFFERED status for this operator
    const offeredBids = await this.prisma.bid.findMany({
      where: {
        operatorId: profile.id,
        status: BidStatus.OFFERED,
      },
      include: {
        job: {
          include: {
            booking: {
              select: {
                bookingReference: true,
                pickupAddress: true,
                dropoffAddress: true,
                pickupDatetime: true,
                vehicleType: true,
                passengerCount: true,
                luggageCount: true,
              },
            },
          },
        },
      },
    });

    return offeredBids.map((bid) => ({
      bidId: bid.id,
      jobId: bid.jobId,
      bidAmount: bid.bidAmount.toString(),
      offeredAt: bid.offeredAt,
      acceptanceDeadline: bid.job.acceptanceWindowClosesAt,
      booking: bid.job.booking,
    }));
  }

  /**
   * Get all vehicles for an operator
   */
  async getVehicles(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    return this.prisma.vehicle.findMany({
      where: { operatorId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new vehicle
   */
  async createVehicle(userId: string, dto: CreateVehicleDto) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    return this.prisma.vehicle.create({
      data: {
        operatorId: profile.id,
        vehicleType: dto.vehicleType,
        registrationPlate: dto.registrationPlate,
        make: dto.make,
        model: dto.model,
        year: dto.year,
      },
    });
  }

  /**
   * Update a vehicle
   */
  async updateVehicle(userId: string, vehicleId: string, dto: UpdateVehicleDto) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.operatorId !== profile.id) {
      throw new BadRequestException('Not authorized to update this vehicle');
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: dto,
    });
  }

  /**
   * Delete a vehicle
   */
  async deleteVehicle(userId: string, vehicleId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.operatorId !== profile.id) {
      throw new BadRequestException('Not authorized to delete this vehicle');
    }

    await this.prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    return { deleted: true, vehicleId };
  }
}

