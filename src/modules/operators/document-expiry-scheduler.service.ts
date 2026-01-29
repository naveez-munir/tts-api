import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../../integrations/notifications/notifications.service.js';

@Injectable()
export class DocumentExpirySchedulerService {
  private readonly logger = new Logger(DocumentExpirySchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Daily check for expiring documents - runs at midnight
   * Sends warnings at 30 days, 7 days, and on expiry
   *
   * NOTE: Cron job disabled for now - uncomment when ready to enable
   */
  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkDocumentExpiry(): Promise<void> {
    this.logger.log('Starting daily document expiry check...');

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      // Find all documents with expiry dates
      const documents = await this.prisma.document.findMany({
        where: {
          expiresAt: { not: null },
        },
        include: {
          operator: {
            include: { user: true },
          },
        },
      });

      let warningsThirtyDays = 0;
      let warningsSevenDays = 0;
      let expiredCount = 0;

      for (const doc of documents) {
        if (!doc.expiresAt) continue;

        const expiresAt = new Date(doc.expiresAt);
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        // Already expired
        if (expiresAt <= now) {
          await this.handleExpiredDocument(doc);
          expiredCount++;
        }
        // Expires in 7 days (send 7-day warning)
        else if (expiresAt <= sevenDaysFromNow && daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
          await this.sendExpiryWarning(doc, daysUntilExpiry);
          warningsSevenDays++;
        }
        // Expires in 30 days (send 30-day warning)
        else if (expiresAt <= thirtyDaysFromNow && daysUntilExpiry > 7 && daysUntilExpiry <= 30) {
          // Only send 30-day warning if today is exactly 30 days before expiry
          if (daysUntilExpiry === 30) {
            await this.sendExpiryWarning(doc, daysUntilExpiry);
            warningsThirtyDays++;
          }
        }
      }

      this.logger.log(
        `Document expiry check complete. ` +
          `30-day warnings: ${warningsThirtyDays}, ` +
          `7-day warnings: ${warningsSevenDays}, ` +
          `Expired: ${expiredCount}`,
      );
    } catch (error) {
      this.logger.error('Error checking document expiry:', error);
    }
  }

  /**
   * Send expiry warning to operator
   */
  private async sendExpiryWarning(
    doc: {
      operatorId: string;
      documentType: string;
      expiresAt: Date | null;
    },
    daysUntilExpiry: number,
  ): Promise<void> {
    if (!doc.expiresAt) return;

    try {
      await this.notificationsService.sendDocumentExpiryWarning(
        doc.operatorId,
        doc.documentType,
        doc.expiresAt,
        daysUntilExpiry,
      );
      this.logger.log(
        `Sent ${daysUntilExpiry}-day expiry warning for ${doc.documentType} to operator ${doc.operatorId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send expiry warning for operator ${doc.operatorId}: ${error}`,
      );
    }
  }

  /**
   * Handle expired document - notify operator and admin
   */
  private async handleExpiredDocument(doc: {
    operatorId: string;
    documentType: string;
    expiresAt: Date | null;
  }): Promise<void> {
    if (!doc.expiresAt) return;

    try {
      // Notify operator about expired document
      await this.notificationsService.sendDocumentExpired(
        doc.operatorId,
        doc.documentType,
        doc.expiresAt,
      );

      // Notify admin about expired document
      await this.notificationsService.sendDocumentExpiryToAdmin(
        doc.operatorId,
        doc.documentType,
        doc.expiresAt,
      );

      this.logger.log(
        `Sent expired document notifications for ${doc.documentType} to operator ${doc.operatorId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send expired document notifications for operator ${doc.operatorId}: ${error}`,
      );
    }
  }
}

