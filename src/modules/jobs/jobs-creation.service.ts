import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { JobStatus, OperatorApprovalStatus } from '@prisma/client';
import { NotificationsService } from '../../integrations/notifications/notifications.service.js';
import { BiddingQueueService } from '../../queue/bidding-queue.service.js';
import { SystemSettingsService } from '../system-settings/system-settings.service.js';

@Injectable()
export class JobsCreationService {
  private readonly logger = new Logger(JobsCreationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly biddingQueueService: BiddingQueueService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async createJobForBooking(bookingId: string, biddingWindowHours: number) {
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
    });

    await this.biddingQueueService.scheduleBiddingWindowClose(job.id, biddingWindowClosesAt);

    return job;
  }

  async broadcastJobToOperators(jobId: string, booking: any) {
    // Get postcode filtering configuration from system settings
    const enablePostcodeFiltering = await this.systemSettingsService.getSettingOrDefault(
      'ENABLE_POSTCODE_FILTERING',
      true,
    );

    let operators: Array<{ id: string }> = [];

    // Check if postcode is missing
    if (!booking.pickupPostcode || booking.pickupPostcode.trim() === '') {
      this.logger.warn(
        `Booking ${booking.id} has no pickup postcode - broadcasting to ${enablePostcodeFiltering ? 'NO' : 'ALL'} operators`,
      );

      if (!enablePostcodeFiltering) {
        // Broadcast to ALL approved operators when postcode filtering is disabled
        operators = await this.prisma.operatorProfile.findMany({
          where: { approvalStatus: OperatorApprovalStatus.APPROVED },
          select: { id: true },
        });
      } else {
        // When filtering is enabled but postcode is missing, don't broadcast
        this.logger.error(
          `Cannot broadcast job ${jobId} - postcode filtering is enabled but pickup postcode is missing`,
        );
        return;
      }
    } else {
      // Postcode exists - apply filtering based on setting
      if (enablePostcodeFiltering) {
        // Filter by postcode prefix (existing behavior)
        const pickupPrefix = booking.pickupPostcode.substring(0, 3).toUpperCase();

        operators = await this.prisma.operatorProfile.findMany({
          where: {
            approvalStatus: OperatorApprovalStatus.APPROVED,
            serviceAreas: {
              some: {
                postcode: {
                  startsWith: pickupPrefix,
                },
              },
            },
          },
          select: { id: true },
        });

        if (operators.length === 0) {
          this.logger.warn(`No operators found for pickup area ${pickupPrefix}`);
          return;
        }
      } else {
        // Postcode filtering disabled - broadcast to ALL approved operators
        operators = await this.prisma.operatorProfile.findMany({
          where: { approvalStatus: OperatorApprovalStatus.APPROVED },
          select: { id: true },
        });
      }
    }

    if (operators.length === 0) {
      this.logger.warn(`No approved operators available to broadcast job ${jobId}`);
      return;
    }

    const operatorIds = operators.map((o) => o.id);

    const maxBidPercent = await this.systemSettingsService.getSettingOrDefault(
      'MAX_BID_PERCENT',
      75,
    );
    const maxBidAmount = ((Number(booking.customerPrice) * maxBidPercent) / 100).toFixed(2);

    await this.notificationsService.broadcastNewJob({
      jobId,
      pickupAddress: booking.pickupAddress,
      pickupPostcode: booking.pickupPostcode || 'N/A',
      dropoffAddress: booking.dropoffAddress,
      dropoffPostcode: booking.dropoffPostcode || 'N/A',
      pickupDatetime: booking.pickupDatetime,
      vehicleType: booking.vehicleType,
      maxBidAmount,
      operatorIds,
      stops: booking.stops?.map((s: { address: string; postcode: string | null }) => ({
        address: s.address,
        postcode: s.postcode,
      })),
    });

    this.logger.log(
      `Broadcast job ${jobId} to ${operatorIds.length} operators (postcode filtering: ${enablePostcodeFiltering ? 'ENABLED' : 'DISABLED'})`,
    );
  }
}

