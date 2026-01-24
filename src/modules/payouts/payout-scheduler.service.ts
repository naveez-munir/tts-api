import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PayoutsService, OperatorPayoutSummary } from './payouts.service.js';
import { ResendService } from '../../integrations/resend/resend.service.js';

@Injectable()
export class PayoutSchedulerService {
  private readonly logger = new Logger(PayoutSchedulerService.name);

  constructor(
    private readonly payoutsService: PayoutsService,
    private readonly resendService: ResendService,
  ) {}

  /**
   * Weekly payout processing - runs every Friday at 9:00 AM
   * Checks settings dynamically before processing
   */
  @Cron(CronExpression.EVERY_WEEK)
  async handleWeeklyPayoutProcessing(): Promise<void> {
    this.logger.log('Starting weekly payout processing check...');

    // Check if payouts are enabled
    const settings = await this.payoutsService.getPayoutSettings();
    
    if (!settings.enabled) {
      this.logger.log('Payouts are disabled in settings. Skipping processing.');
      return;
    }

    // Check if today is the configured payout day
    const today = new Date().getDay(); // 0 = Sunday, 5 = Friday
    if (today !== settings.payoutDay) {
      this.logger.log(`Today is not payout day (configured: ${settings.payoutDay}, today: ${today}). Skipping.`);
      return;
    }

    await this.processPayouts();
  }

  /**
   * Manual trigger for payout processing (can be called by admin)
   */
  async processPayouts(): Promise<void> {
    this.logger.log('Processing payouts...');

    try {
      const result = await this.payoutsService.calculatePayoutSummaries();

      if (result.operatorPayouts.length === 0) {
        this.logger.log('No eligible payouts to process.');
        return;
      }

      // Mark all jobs as PROCESSING
      const allJobIds: string[] = [];
      for (const payout of result.operatorPayouts) {
        for (const job of payout.jobs) {
          allJobIds.push(job.id);
        }
      }
      await this.payoutsService.markJobsAsProcessing(allJobIds);

      // Send email to admin with payout summary
      const settings = await this.payoutsService.getPayoutSettings();
      await this.sendAdminPayoutEmail(settings.adminEmail, result.operatorPayouts, result.skippedOperators);

      this.logger.log(
        `Payout processing complete. ${result.operatorPayouts.length} operators ready for payout. ` +
        `Admin email sent to ${settings.adminEmail}.`
      );
    } catch (error) {
      this.logger.error('Error processing payouts:', error);
    }
  }

  /**
   * Send admin email with payout summary
   */
  private async sendAdminPayoutEmail(
    adminEmail: string,
    payouts: OperatorPayoutSummary[],
    skipped: Array<{ operatorId: string; companyName: string; reason: string }>,
  ): Promise<void> {
    const totalAmount = payouts.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalJobs = payouts.reduce((sum, p) => sum + p.jobCount, 0);

    const operatorRows = payouts.map(p => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; font-weight: 600;">${p.companyName}</td>
        <td style="padding: 12px;">${p.contactEmail}</td>
        <td style="padding: 12px; font-family: monospace;">${p.bankSortCode}</td>
        <td style="padding: 12px; font-family: monospace;">${p.bankAccountNumber}</td>
        <td style="padding: 12px;">${p.bankAccountName}</td>
        <td style="padding: 12px; text-align: center;">${p.jobCount}</td>
        <td style="padding: 12px; text-align: right; font-weight: 600; color: #059669;">£${p.totalAmount.toFixed(2)}</td>
      </tr>
    `).join('');

    const skippedSection = skipped.length > 0 ? `
      <div style="margin-top: 24px; padding: 16px; background-color: #fef3c7; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; color: #92400e;">⚠️ Skipped Operators (${skipped.length})</h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${skipped.map(s => `<li><strong>${s.companyName}</strong>: ${s.reason}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background-color: #1e3a5f; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">🏦 Weekly Payout Summary</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
          <div style="display: flex; gap: 24px; margin-bottom: 24px;">
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; flex: 1;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Total Operators</p>
              <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700;">${payouts.length}</p>
            </div>
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; flex: 1;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Total Jobs</p>
              <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700;">${totalJobs}</p>
            </div>
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #059669; flex: 1;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Total Amount</p>
              <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #059669;">£${totalAmount.toFixed(2)}</p>
            </div>
          </div>

          <h2 style="margin: 0 0 16px 0; color: #111827;">Operators Ready for Payout</h2>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left;">Company</th>
                <th style="padding: 12px; text-align: left;">Email</th>
                <th style="padding: 12px; text-align: left;">Sort Code</th>
                <th style="padding: 12px; text-align: left;">Account No.</th>
                <th style="padding: 12px; text-align: left;">Account Name</th>
                <th style="padding: 12px; text-align: center;">Jobs</th>
                <th style="padding: 12px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${operatorRows}
            </tbody>
          </table>
          ${skippedSection}
          <div style="margin-top: 24px; padding: 16px; background-color: #dbeafe; border-radius: 8px;">
            <p style="margin: 0; color: #1e40af;">
              <strong>Next Steps:</strong> Process bank transfers for each operator above, then mark payouts as completed in the Admin Panel.
            </p>
          </div>
        </div>
      </div>
    `;

    await this.resendService.sendEmail({
      to: adminEmail,
      subject: `🏦 Weekly Payout Summary - ${payouts.length} Operators Ready (£${totalAmount.toFixed(2)})`,
      html,
    });

    this.logger.log(`Admin payout email sent to ${adminEmail}`);
  }
}

