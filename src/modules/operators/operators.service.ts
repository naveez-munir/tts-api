import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { OperatorProfile, OperatorApprovalStatus, JobStatus, BidStatus, Driver, Vehicle, VehiclePhotoType, PayoutStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { RegisterOperatorDto } from './dto/register-operator.dto.js';
import type { UpdateOperatorProfileDto } from './dto/update-operator-profile.dto.js';
import type { UpdateBankDetailsDto } from './dto/update-bank-details.dto.js';
import type { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto.js';
import type { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto.js';
import type { UpdateVehiclePhotosDto } from './dto/vehicle-photo.dto.js';
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

    // Notify admin about new operator registration
    this.notificationsService.sendNewOperatorRegistrationToAdmin(profile.id).catch((err) => {
      console.error(`Failed to send new operator registration notification to admin: ${err.message}`);
    });

    // Send welcome email to operator
    this.notificationsService.sendOperatorWelcome(profile.id).catch((err) => {
      console.error(`Failed to send operator welcome email: ${err.message}`);
    });

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

    const [totalBids, wonBids, availableJobs, unpaidJobs, completedPayouts, processingPayouts] = await Promise.all([
      this.prisma.bid.count({
        where: { operatorId: profile.id },
      }),

      this.prisma.bid.count({
        where: {
          operatorId: profile.id,
          status: 'WON',
        },
      }),

      this.prisma.job.findMany({
        where: {
          status: JobStatus.OPEN_FOR_BIDDING,
          booking: {
            pickupPostcode: {
              startsWith: profile.serviceAreas[0]?.postcode.substring(0, 3) || '',
            },
          },
        },
      }),

      this.prisma.job.findMany({
        where: {
          assignedOperatorId: profile.id,
          status: JobStatus.COMPLETED,
          payoutStatus: {
            in: [PayoutStatus.PENDING, PayoutStatus.NOT_ELIGIBLE]
          }
        },
        select: {
          winningBid: {
            select: { bidAmount: true }
          }
        }
      }),

      this.prisma.job.aggregate({
        where: {
          assignedOperatorId: profile.id,
          status: JobStatus.COMPLETED,
          payoutStatus: PayoutStatus.COMPLETED
        },
        _sum: {
          platformMargin: true
        }
      }),

      this.prisma.job.aggregate({
        where: {
          assignedOperatorId: profile.id,
          status: JobStatus.COMPLETED,
          payoutStatus: PayoutStatus.PROCESSING
        },
        _sum: {
          platformMargin: true
        }
      })
    ]);

    const totalPendingEarnings = unpaidJobs.reduce((sum, job) => sum + Number(job.winningBid?.bidAmount || 0), 0);
    const completedPayoutsAmount = Number(completedPayouts._sum.platformMargin || 0);
    const processingPayoutsAmount = Number(processingPayouts._sum.platformMargin || 0);

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
        totalPendingEarnings,
        completedPayouts: completedPayoutsAmount,
        processingPayouts: processingPayoutsAmount,
        unpaidJobCount: unpaidJobs.length,
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

    // Handle service areas update if provided
    if (dto.serviceAreas !== undefined) {
      // Delete existing service areas
      await this.prisma.serviceArea.deleteMany({
        where: { operatorId: profile.id },
      });

      // Create new service areas
      if (dto.serviceAreas.length > 0) {
        await this.prisma.serviceArea.createMany({
          data: dto.serviceAreas.map((postcode) => ({
            operatorId: profile.id,
            postcode,
          })),
        });
      }
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

  private async generateDriverDocumentUrls(driver: Driver & { vehicle?: any }) {
    const result = { ...driver } as Record<string, unknown>;
    const documentFields = [
      'profileImageUrl',
      'passportUrl',
      'drivingLicenseFrontUrl',
      'drivingLicenseBackUrl',
      'nationalInsuranceDocUrl',
      'taxiCertificationUrl',
      'taxiBadgePhotoUrl',
    ];

    for (const field of documentFields) {
      const value = driver[field as keyof Driver];
      if (value && typeof value === 'string') {
        if (value.startsWith('http')) {
          result[field] = value;
        } else {
          const { downloadUrl } = await this.s3Service.generateDownloadUrl(value);
          result[field] = downloadUrl;
        }
      }
    }

    // Handle vehicle if present
    if (driver.vehicle) {
      const vehicleWithUrls = await this.generateVehicleDocumentUrls(driver.vehicle);
      
      // Handle vehicle photos
      if (driver.vehicle.photos && Array.isArray(driver.vehicle.photos)) {
        const photosWithUrls = await Promise.all(
          driver.vehicle.photos.map(async (photo: any) => {
            if (photo.photoUrl.startsWith('http')) {
              return photo;
            } else {
              const { downloadUrl } = await this.s3Service.generateDownloadUrl(photo.photoUrl);
              return { ...photo, photoUrl: downloadUrl };
            }
          })
        );
        vehicleWithUrls.photos = photosWithUrls;
      }
      
      result.vehicle = vehicleWithUrls;
    }

    return result;
  }

  private async generateVehicleDocumentUrls(vehicle: Vehicle) {
    const result = { ...vehicle } as Record<string, unknown>;
    const documentFields = [
      'logbookUrl',
      'motCertificateUrl',
      'insuranceDocumentUrl',
      'hirePermissionLetterUrl',
    ];

    for (const field of documentFields) {
      const value = vehicle[field as keyof Vehicle];
      if (value && typeof value === 'string') {
        if (value.startsWith('http')) {
          result[field] = value;
        } else {
          const { downloadUrl } = await this.s3Service.generateDownloadUrl(value);
          result[field] = downloadUrl;
        }
      }
    }

    return result;
  }

  async getVehicles(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const vehicles = await this.prisma.vehicle.findMany({
      where: { operatorId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { photos: true },
    });

    return Promise.all(
      vehicles.map(async (vehicle) => {
        const vehicleWithUrls = await this.generateVehicleDocumentUrls(vehicle);
        const photosWithUrls = await Promise.all(
          vehicle.photos.map(async (photo) => {
            if (photo.photoUrl.startsWith('http')) {
              return photo;
            }
            const { downloadUrl } = await this.s3Service.generateDownloadUrl(photo.photoUrl);
            return { ...photo, photoUrl: downloadUrl };
          })
        );
        return { ...vehicleWithUrls, photos: photosWithUrls };
      })
    );
  }

  async getVehicle(userId: string, vehicleId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { photos: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.operatorId !== profile.id) {
      throw new BadRequestException('Not authorized to view this vehicle');
    }

    const vehicleWithUrls = await this.generateVehicleDocumentUrls(vehicle);

    const photosWithUrls = await Promise.all(
      vehicle.photos.map(async (photo) => {
        if (photo.photoUrl.startsWith('http')) {
          return photo;
        }
        const { downloadUrl } = await this.s3Service.generateDownloadUrl(photo.photoUrl);
        return { ...photo, photoUrl: downloadUrl };
      })
    );

    return { ...vehicleWithUrls, photos: photosWithUrls };
  }

  async createVehicle(userId: string, dto: CreateVehicleDto) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    if (dto.driverId) {
      const driver = await this.prisma.driver.findFirst({
        where: {
          id: dto.driverId,
          operatorId: profile.id
        },
        include: { vehicle: true }
      });

      if (!driver) {
        throw new BadRequestException('Driver not found or does not belong to your fleet');
      }

      if (driver.vehicleId) {
        throw new BadRequestException(
          `Driver ${driver.firstName} ${driver.lastName} already has vehicle ${driver.vehicle?.registrationPlate} assigned`
        );
      }
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        operatorId: profile.id,
        vehicleType: dto.vehicleType,
        registrationPlate: dto.registrationPlate,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        color: dto.color,
        logbookUrl: dto.logbookUrl,
        motCertificateUrl: dto.motCertificateUrl,
        motExpiryDate: dto.motExpiryDate ? new Date(dto.motExpiryDate) : null,
        insuranceDocumentUrl: dto.insuranceDocumentUrl,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : null,
        hirePermissionLetterUrl: dto.hirePermissionLetterUrl,
      },
      include: { driver: true }
    });

    if (dto.driverId) {
      await this.prisma.driver.update({
        where: { id: dto.driverId },
        data: { vehicleId: vehicle.id }
      });
    }

    const vehicleCount = await this.prisma.vehicle.count({
      where: { operatorId: profile.id },
    });

    await this.prisma.operatorProfile.update({
      where: { id: profile.id },
      data: { fleetSize: vehicleCount },
    });

    return dto.driverId
      ? this.prisma.vehicle.findUnique({
          where: { id: vehicle.id },
          include: { driver: true }
        })
      : vehicle;
  }

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
      data: {
        vehicleType: dto.vehicleType,
        registrationPlate: dto.registrationPlate,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        color: dto.color,
        logbookUrl: dto.logbookUrl,
        motCertificateUrl: dto.motCertificateUrl,
        motExpiryDate: dto.motExpiryDate ? new Date(dto.motExpiryDate) : undefined,
        insuranceDocumentUrl: dto.insuranceDocumentUrl,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : undefined,
        hirePermissionLetterUrl: dto.hirePermissionLetterUrl,
        isActive: dto.isActive,
      },
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

    const vehicleCount = await this.prisma.vehicle.count({
      where: { operatorId: profile.id },
    });

    await this.prisma.operatorProfile.update({
      where: { id: profile.id },
      data: { fleetSize: vehicleCount },
    });

    return { deleted: true, vehicleId };
  }

  async getDrivers(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const drivers = await this.prisma.driver.findMany({
      where: { operatorId: profile.id },
      include: { 
        vehicle: {
          include: { photos: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(drivers.map((driver) => this.generateDriverDocumentUrls(driver)));
  }

  async getDriver(userId: string, driverId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { 
        vehicle: {
          include: { photos: true }
        }
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.operatorId !== profile.id) {
      throw new BadRequestException('Not authorized to view this driver');
    }

    return this.generateDriverDocumentUrls(driver);
  }

  async createDriver(userId: string, dto: CreateDriverDto) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    return this.prisma.driver.create({
      data: {
        operatorId: profile.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        profileImageUrl: dto.profileImageUrl,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        passportUrl: dto.passportUrl,
        passportExpiry: dto.passportExpiry ? new Date(dto.passportExpiry) : null,
        drivingLicenseNumber: dto.drivingLicenseNumber,
        drivingLicenseFrontUrl: dto.drivingLicenseFrontUrl,
        drivingLicenseBackUrl: dto.drivingLicenseBackUrl,
        drivingLicenseExpiry: dto.drivingLicenseExpiry ? new Date(dto.drivingLicenseExpiry) : null,
        nationalInsuranceNo: dto.nationalInsuranceNo,
        nationalInsuranceDocUrl: dto.nationalInsuranceDocUrl,
        taxiCertificationUrl: dto.taxiCertificationUrl,
        taxiCertificationExpiry: dto.taxiCertificationExpiry ? new Date(dto.taxiCertificationExpiry) : null,
        taxiBadgePhotoUrl: dto.taxiBadgePhotoUrl,
        taxiBadgeExpiry: dto.taxiBadgeExpiry ? new Date(dto.taxiBadgeExpiry) : null,
        phvLicenseNumber: dto.phvLicenseNumber,
        phvLicenseExpiry: dto.phvLicenseExpiry ? new Date(dto.phvLicenseExpiry) : null,
        issuingCouncil: dto.issuingCouncil,
        badgeNumber: dto.badgeNumber,
      },
    });
  }

  async updateDriver(userId: string, driverId: string, dto: UpdateDriverDto) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.operatorId !== profile.id) {
      throw new BadRequestException('Not authorized to update this driver');
    }

    // Detect active status change and whether driver has a linked vehicle
    const isBeingDeactivated = dto.isActive === false && driver.isActive === true;
    const isBeingReactivated = dto.isActive === true && driver.isActive === false;

    return this.prisma.$transaction(async (tx) => {
      const updatedDriver = await tx.driver.update({
        where: { id: driverId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          profileImageUrl: dto.profileImageUrl,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          passportUrl: dto.passportUrl,
          passportExpiry: dto.passportExpiry ? new Date(dto.passportExpiry) : undefined,
          drivingLicenseNumber: dto.drivingLicenseNumber,
          drivingLicenseFrontUrl: dto.drivingLicenseFrontUrl,
          drivingLicenseBackUrl: dto.drivingLicenseBackUrl,
          drivingLicenseExpiry: dto.drivingLicenseExpiry ? new Date(dto.drivingLicenseExpiry) : undefined,
          nationalInsuranceNo: dto.nationalInsuranceNo,
          nationalInsuranceDocUrl: dto.nationalInsuranceDocUrl,
          taxiCertificationUrl: dto.taxiCertificationUrl,
          taxiCertificationExpiry: dto.taxiCertificationExpiry ? new Date(dto.taxiCertificationExpiry) : undefined,
          taxiBadgePhotoUrl: dto.taxiBadgePhotoUrl,
          taxiBadgeExpiry: dto.taxiBadgeExpiry ? new Date(dto.taxiBadgeExpiry) : undefined,
          phvLicenseNumber: dto.phvLicenseNumber,
          phvLicenseExpiry: dto.phvLicenseExpiry ? new Date(dto.phvLicenseExpiry) : undefined,
          issuingCouncil: dto.issuingCouncil,
          badgeNumber: dto.badgeNumber,
          isActive: dto.isActive,
          vehicle: dto.vehicleId !== undefined
            ? dto.vehicleId
              ? { connect: { id: dto.vehicleId } }
              : { disconnect: true }
            : undefined,
        },
      });

      // If driver has a linked vehicle and active status changed, sync vehicle + fleetSize
      if (driver.vehicleId && (isBeingDeactivated || isBeingReactivated)) {
        // Deactivate/reactivate the linked vehicle along with the driver
        await tx.vehicle.update({
          where: { id: driver.vehicleId },
          data: { isActive: !isBeingDeactivated },
        });

        // Adjust fleetSize: decrement on deactivate, increment on reactivate (never below 0)
        const currentFleetSize = profile.fleetSize ?? 0;
        const newFleetSize = isBeingDeactivated
          ? Math.max(0, currentFleetSize - 1)
          : currentFleetSize + 1;

        await tx.operatorProfile.update({
          where: { id: profile.id },
          data: { fleetSize: newFleetSize },
        });
      }

      return updatedDriver;
    });
  }

  async deleteDriver(userId: string, driverId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.operatorId !== profile.id) {
      throw new BadRequestException('Not authorized to delete this driver');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete the linked vehicle first (if any), which also cascades its photos
      if (driver.vehicleId) {
        await tx.vehicle.delete({
          where: { id: driver.vehicleId },
        });
      }

      await tx.driver.delete({
        where: { id: driverId },
      });

      // Update fleetSize if a vehicle was deleted
      if (driver.vehicleId) {
        const vehicleCount = await tx.vehicle.count({
          where: { operatorId: profile.id },
        });

        await tx.operatorProfile.update({
          where: { id: profile.id },
          data: { fleetSize: vehicleCount },
        });
      }
    });

    return { deleted: true, driverId };
  }

  async getVehiclePhotos(userId: string, vehicleId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { photos: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.operatorId !== profile.id) {
      throw new BadRequestException('Not authorized to view this vehicle');
    }

    return Promise.all(
      vehicle.photos.map(async (photo) => {
        if (photo.photoUrl.startsWith('http')) {
          return photo;
        }
        const { downloadUrl } = await this.s3Service.generateDownloadUrl(photo.photoUrl);
        return { ...photo, photoUrl: downloadUrl };
      })
    );
  }

  async updateVehiclePhotos(userId: string, vehicleId: string, dto: UpdateVehiclePhotosDto) {
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

    // Get photo types being provided in the request
    const providedPhotoTypes = dto.photos.map(p => p.photoType);

    // All possible photo types
    const allPhotoTypes: VehiclePhotoType[] = ['FRONT', 'BACK', 'DRIVER_SIDE', 'FRONT_SIDE', 'DASHBOARD', 'REAR_BOOT'];

    // Photo types to delete (not in the provided list)
    const photoTypesToDelete = allPhotoTypes.filter(type => !providedPhotoTypes.includes(type));

    // Delete photos that are not in the provided list
    if (photoTypesToDelete.length > 0) {
      await this.prisma.vehiclePhoto.deleteMany({
        where: {
          vehicleId,
          photoType: {
            in: photoTypesToDelete as VehiclePhotoType[],
          },
        },
      });
    }

    // Upsert provided photos
    const photos = dto.photos.length > 0
      ? await Promise.all(
          dto.photos.map(async (photo) => {
            return this.prisma.vehiclePhoto.upsert({
              where: {
                vehicleId_photoType: {
                  vehicleId,
                  photoType: photo.photoType as VehiclePhotoType,
                },
              },
              update: {
                photoUrl: photo.photoUrl,
              },
              create: {
                vehicleId,
                photoType: photo.photoType as VehiclePhotoType,
                photoUrl: photo.photoUrl,
              },
            });
          })
        )
      : [];

    return photos;
  }
}
