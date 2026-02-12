import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkDocumentExpiry(): Promise<void> {
    this.logger.log('Starting daily document expiry check...');

    await Promise.all([
      this.checkOperatorDocumentExpiry(),
      this.checkVehicleDocumentExpiry(),
    ]);

    this.logger.log('Daily document expiry check complete.');
  }

  // =========================================================================
  // OPERATOR DOCUMENTS (Document model)
  // =========================================================================

  private async checkOperatorDocumentExpiry(): Promise<void> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
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

        if (expiresAt <= now) {
          await this.handleExpiredDocument(doc);
          expiredCount++;
        } else if (expiresAt <= sevenDaysFromNow && daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
          await this.sendExpiryWarning(doc, daysUntilExpiry);
          warningsSevenDays++;
        } else if (daysUntilExpiry === 30) {
          await this.sendExpiryWarning(doc, daysUntilExpiry);
          warningsThirtyDays++;
        }
      }

      this.logger.log(
        `Operator document expiry check: 30-day warnings: ${warningsThirtyDays}, ` +
          `7-day warnings: ${warningsSevenDays}, Expired: ${expiredCount}`,
      );
    } catch (error) {
      this.logger.error('Error checking operator document expiry:', error);
    }
  }

  private async sendExpiryWarning(
    doc: { operatorId: string; documentType: string; expiresAt: Date | null },
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
      this.logger.error(`Failed to send expiry warning for operator ${doc.operatorId}: ${error}`);
    }
  }

  private async handleExpiredDocument(doc: {
    operatorId: string;
    documentType: string;
    expiresAt: Date | null;
  }): Promise<void> {
    if (!doc.expiresAt) return;
    try {
      await this.notificationsService.sendDocumentExpired(doc.operatorId, doc.documentType, doc.expiresAt);
      await this.notificationsService.sendDocumentExpiryToAdmin(doc.operatorId, doc.documentType, doc.expiresAt);
      this.logger.log(
        `Sent expired document notifications for ${doc.documentType} to operator ${doc.operatorId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send expired document notifications for operator ${doc.operatorId}: ${error}`);
    }
  }

  // =========================================================================
  // VEHICLE DOCUMENTS (Vehicle model)
  // =========================================================================

  /**
   * Maps vehicle document field names to human-readable labels
   */
  private readonly vehicleDocumentFields: Array<{
    expiryField: 'motExpiryDate' | 'insuranceExpiryDate' | 'logbookExpiryDate' | 'hirePermissionLetterExpiryDate';
    label: string;
  }> = [
    { expiryField: 'motExpiryDate', label: 'MOT Certificate' },
    { expiryField: 'insuranceExpiryDate', label: 'Vehicle Insurance' },
    { expiryField: 'logbookExpiryDate', label: 'Vehicle Logbook' },
    { expiryField: 'hirePermissionLetterExpiryDate', label: 'Hire Permission Letter' },
  ];

  private async checkVehicleDocumentExpiry(): Promise<void> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      // Fetch all active vehicles that have at least one expiry date set
      const vehicles = await this.prisma.vehicle.findMany({
        where: {
          isActive: true,
          OR: [
            { motExpiryDate: { not: null } },
            { insuranceExpiryDate: { not: null } },
          ],
        },
      });

      let warningsThirtyDays = 0;
      let warningsSevenDays = 0;
      let expiredCount = 0;

      for (const vehicle of vehicles) {
        // Cast to any to access dynamically-resolved fields after migration
        const v = vehicle as Record<string, unknown>;

        for (const { expiryField, label } of this.vehicleDocumentFields) {
          const expiryValue = v[expiryField];
          if (!expiryValue) continue;

          const expiresAt = new Date(expiryValue as string);
          const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          const documentLabel = `${label} (${vehicle.registrationPlate})`;

          if (expiresAt <= now) {
            await this.handleExpiredVehicleDocument(vehicle.operatorId, documentLabel, expiresAt, vehicle.id);
            expiredCount++;
          } else if (expiresAt <= sevenDaysFromNow && daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
            await this.sendVehicleExpiryWarning(vehicle.operatorId, documentLabel, expiresAt, daysUntilExpiry, vehicle.id);
            warningsSevenDays++;
          } else if (daysUntilExpiry === 30) {
            await this.sendVehicleExpiryWarning(vehicle.operatorId, documentLabel, expiresAt, daysUntilExpiry, vehicle.id);
            warningsThirtyDays++;
          }
        }
      }

      this.logger.log(
        `Vehicle document expiry check: 30-day warnings: ${warningsThirtyDays}, ` +
          `7-day warnings: ${warningsSevenDays}, Expired: ${expiredCount}`,
      );
    } catch (error) {
      this.logger.error('Error checking vehicle document expiry:', error);
    }
  }

  private async sendVehicleExpiryWarning(
    operatorId: string,
    documentType: string,
    expiresAt: Date,
    daysUntilExpiry: number,
    vehicleId: string,
  ): Promise<void> {
    try {
      await this.notificationsService.sendVehicleDocumentExpiryWarning(
        operatorId,
        documentType,
        expiresAt,
        daysUntilExpiry,
        vehicleId,
      );
      this.logger.log(
        `Sent ${daysUntilExpiry}-day expiry warning for vehicle document "${documentType}" to operator ${operatorId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send vehicle expiry warning for operator ${operatorId}: ${error}`);
    }
  }

  private async handleExpiredVehicleDocument(
    operatorId: string,
    documentType: string,
    expiresAt: Date,
    vehicleId: string,
  ): Promise<void> {
    try {
      await this.notificationsService.sendVehicleDocumentExpired(operatorId, documentType, expiresAt, vehicleId);
      await this.notificationsService.sendVehicleDocumentExpiryToAdmin(operatorId, documentType, expiresAt, vehicleId);
      this.logger.log(
        `Sent expired vehicle document notifications for "${documentType}" to operator ${operatorId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send expired vehicle document notifications for operator ${operatorId}: ${error}`);
    }
  }
}
