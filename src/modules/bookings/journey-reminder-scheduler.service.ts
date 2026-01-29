import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../../integrations/notifications/notifications.service.js';
import { BookingStatus, JobStatus } from '@prisma/client';

@Injectable()
export class JourneyReminderSchedulerService {
  private readonly logger = new Logger(JourneyReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Check for bookings with pickup in the next 24 hours and send reminders
   * Runs every hour to catch bookings as they enter the 24-hour window
   *
   * NOTE: Cron job disabled for now - uncomment when ready to enable
   */
  // @Cron(CronExpression.EVERY_HOUR)
  async sendJourneyReminders(): Promise<void> {
    this.logger.log('Starting journey reminder check...');

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twentyThreeHoursFromNow = new Date(now.getTime() + 23 * 60 * 60 * 1000);

    try {
      // Find bookings with pickup between 23 and 24 hours from now
      // This ensures we only send the reminder once (during the 1-hour window)
      const bookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.PAID,
          pickupDatetime: {
            gte: twentyThreeHoursFromNow,
            lte: twentyFourHoursFromNow,
          },
        },
        include: {
          customer: true,
          job: {
            include: {
              driverDetails: true,
            },
          },
        },
      });

      let remindersSent = 0;

      for (const booking of bookings) {
        try {
          // Get driver details if job is assigned and has driver details
          let driverDetails: {
            driverName: string;
            driverPhone: string;
            vehicleRegistration: string;
          } | undefined;

          if (
            booking.job &&
            booking.job.status === JobStatus.ASSIGNED &&
            booking.job.driverDetails
          ) {
            driverDetails = {
              driverName: booking.job.driverDetails.driverName,
              driverPhone: booking.job.driverDetails.driverPhone,
              vehicleRegistration: booking.job.driverDetails.vehicleRegistration,
            };
          }

          await this.notificationsService.sendJourneyReminder(
            booking.id,
            driverDetails,
          );

          remindersSent++;
          this.logger.log(
            `Sent journey reminder for booking ${booking.bookingReference}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send journey reminder for booking ${booking.id}: ${error}`,
          );
        }
      }

      this.logger.log(
        `Journey reminder check complete. Sent ${remindersSent} reminders out of ${bookings.length} eligible bookings.`,
      );
    } catch (error) {
      this.logger.error('Error checking for journey reminders:', error);
    }
  }
}

