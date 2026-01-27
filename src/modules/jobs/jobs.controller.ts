import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JobsService } from './jobs.service.js';
import { CreateJobSchema } from './dto/create-job.dto.js';
import type { CreateJobDto } from './dto/create-job.dto.js';
import { PrismaService } from '../../database/prisma.service.js';
import { JobStatus } from '@prisma/client';
import { SystemSettingsService } from '../system-settings/system-settings.service.js';
import { NotificationsService } from '../../integrations/notifications/notifications.service.js';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateJobSchema)) createJobDto: CreateJobDto,
  ) {
    const job = await this.jobsService.createFromBooking(
      createJobDto.bookingId,
      createJobDto.biddingWindowHours,
    );
    return {
      success: true,
      data: job,
    };
  }

  // ============================================================================
  // SPECIFIC ROUTES (must come BEFORE parameterized :id routes)
  // ============================================================================

  /**
   * GET /jobs/operator/available
   * Get available jobs for the current operator based on their service areas
   */
  @Get('operator/available')
  async getOperatorAvailableJobs(@CurrentUser() user: any) {
    // Get operator profile with service areas
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
      include: { serviceAreas: true },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    // Get postcode filtering configuration
    const enablePostcodeFiltering = await this.systemSettingsService.getSettingOrDefault(
      'ENABLE_POSTCODE_FILTERING',
      true,
    );

    const now = new Date();
    let jobs;

    if (!enablePostcodeFiltering) {
      // Postcode filtering disabled - show ALL open jobs to this operator
      jobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.OPEN_FOR_BIDDING,
          biddingWindowClosesAt: { gt: now },
        },
        include: {
          booking: {
            include: {
              stops: { orderBy: { stopOrder: 'asc' } },
            },
          },
          bids: {
            where: { operatorId: profile.id },
            select: { id: true, bidAmount: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Postcode filtering enabled - filter by service areas
      const postcodes = profile.serviceAreas.map((sa) => sa.postcode);

      if (postcodes.length === 0) {
        return {
          success: true,
          data: [],
          meta: { total: 0 },
        };
      }

      // Build OR conditions: match by postcode prefix OR jobs with null postcode
      const postcodeConditions: any[] = postcodes.map((postcode) => ({
        pickupPostcode: {
          startsWith: postcode.substring(0, 3).toUpperCase(),
        },
      }));

      // Also include jobs where pickupPostcode is null (show to all operators)
      postcodeConditions.push({ pickupPostcode: null });

      jobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.OPEN_FOR_BIDDING,
          biddingWindowClosesAt: { gt: now },
          booking: {
            OR: postcodeConditions,
          },
        },
        include: {
          booking: {
            include: {
              stops: { orderBy: { stopOrder: 'asc' } },
            },
          },
          bids: {
            where: { operatorId: profile.id },
            select: { id: true, bidAmount: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return {
      success: true,
      data: jobs,
      meta: { total: jobs.length },
    };
  }

  /**
   * GET /jobs/operator/assigned
   * Get jobs assigned to the current operator
   */
  @Get('operator/assigned')
  async getOperatorAssignedJobs(@CurrentUser() user: any) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const jobs = await this.prisma.job.findMany({
      where: {
        assignedOperatorId: profile.id,
        status: {
          in: [JobStatus.ASSIGNED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED],
        },
      },
      include: {
        booking: {
          include: {
            stops: { orderBy: { stopOrder: 'asc' } },
          },
        },
        winningBid: true,
        driverDetails: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: jobs,
      meta: { total: jobs.length },
    };
  }

  @Get('available/:postcode')
  async findAvailableJobs(@Param('postcode') postcode: string) {
    const jobs = await this.jobsService.findAvailableJobs(postcode);
    return {
      success: true,
      data: jobs,
      meta: {
        total: jobs.length,
      },
    };
  }

  // ============================================================================
  // PARAMETERIZED ROUTES (must come AFTER specific routes)
  // ============================================================================

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const job = await this.jobsService.findOne(id);
    return {
      success: true,
      data: job,
    };
  }

  @Post(':id/assign-winner')
  async assignWinningBid(@Param('id') id: string) {
    const job = await this.jobsService.assignWinningBid(id);
    return {
      success: true,
      data: job,
      message: 'Winning bid assigned successfully',
    };
  }

  /**
   * POST /jobs/:id/driver-details
   * Submit driver details for an assigned job
   */
  @Post(':id/driver-details')
  @HttpCode(HttpStatus.OK)
  async submitDriverDetails(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() driverDetails: {
      driverName: string;
      driverPhone: string;
      vehicleRegistration: string;
      vehicleMake?: string;
      vehicleModel?: string;
      vehicleColor?: string;
      taxiLicenceNumber?: string;
      issuingCouncil?: string;
    },
  ) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            stops: { orderBy: { stopOrder: 'asc' } },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.assignedOperatorId !== profile.id) {
      throw new NotFoundException('Job not assigned to this operator');
    }

    // Create or update driver details
    await this.prisma.driverDetails.upsert({
      where: { jobId: id },
      create: {
        jobId: id,
        driverName: driverDetails.driverName,
        driverPhone: driverDetails.driverPhone,
        vehicleRegistration: driverDetails.vehicleRegistration,
        vehicleMake: driverDetails.vehicleMake,
        vehicleModel: driverDetails.vehicleModel,
        vehicleColor: driverDetails.vehicleColor,
        taxiLicenceNumber: driverDetails.taxiLicenceNumber,
        issuingCouncil: driverDetails.issuingCouncil,
      },
      update: {
        driverName: driverDetails.driverName,
        driverPhone: driverDetails.driverPhone,
        vehicleRegistration: driverDetails.vehicleRegistration,
        vehicleMake: driverDetails.vehicleMake,
        vehicleModel: driverDetails.vehicleModel,
        vehicleColor: driverDetails.vehicleColor,
        taxiLicenceNumber: driverDetails.taxiLicenceNumber,
        issuingCouncil: driverDetails.issuingCouncil,
      },
    });

    // Update job status to IN_PROGRESS
    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: { status: JobStatus.IN_PROGRESS },
      include: {
        booking: {
          include: {
            stops: { orderBy: { stopOrder: 'asc' } },
          },
        },
        driverDetails: true,
      },
    });

    // Send driver assignment notification to customer
    try {
      await this.notificationsService.sendDriverAssignment({
        customerId: job.booking.customerId,
        bookingReference: job.booking.bookingReference,
        driverName: driverDetails.driverName,
        driverPhone: driverDetails.driverPhone,
        vehicleRegistration: driverDetails.vehicleRegistration,
        pickupDatetime: job.booking.pickupDatetime,
        pickupAddress: job.booking.pickupAddress,
        journeyType: job.booking.journeyType as 'ONE_WAY' | 'OUTBOUND' | 'RETURN',
        groupReference: job.booking.bookingGroupId || undefined,
      });
      this.logger.log(`Driver assignment notification sent for booking ${job.booking.bookingReference}`);
    } catch (error) {
      // Log error but don't fail the request - driver details were saved successfully
      this.logger.error(`Failed to send driver assignment notification for booking ${job.booking.bookingReference}:`, error);
    }

    return {
      success: true,
      data: updatedJob,
      message: 'Driver details submitted successfully',
    };
  }

  /**
   * POST /jobs/:id/complete
   * Mark a job as completed
   */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeJob(@CurrentUser() user: any, @Param('id') id: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const job = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.assignedOperatorId !== profile.id) {
      throw new NotFoundException('Job not assigned to this operator');
    }

    const completedJob = await this.jobsService.completeJob(id);

    return {
      success: true,
      data: completedJob,
      message: 'Job marked as completed',
    };
  }
}
