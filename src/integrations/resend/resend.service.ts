import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface BookingConfirmationData {
  customerName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  vehicleType: string;
  passengerCount: number;
  totalPrice: string;
}

export interface DriverAssignedData {
  customerName: string;
  bookingReference: string;
  driverName: string;
  driverPhone: string;
  vehicleRegistration: string;
  pickupDatetime: string;
  pickupAddress: string;
}

export interface NewJobAlertData {
  operatorName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  vehicleType: string;
  maxBidAmount: string;
  jobId: string;
}

export interface BidWonData {
  operatorName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  bidAmount: string;
}

export interface JobOfferData {
  operatorName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  bidAmount: string;
  acceptanceDeadline: string;
}

export interface BookingCancellationData {
  customerName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  refundAmount: string;
  refundPercent: number;
  cancellationReason?: string;
}

export interface OperatorJobCancellationData {
  operatorName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
}

export interface OperatorJobModificationData {
  operatorName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  passengerCount: number;
  luggageCount: number;
  vehicleType: string;
  changes: string[];
}

export interface WelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
}

export interface PasswordResetOTPData {
  firstName: string;
  lastName: string;
  otp: string;
}

export interface EmailVerificationOTPData {
  firstName: string;
  lastName: string;
  otp: string;
}

// Operator Lifecycle Notification Interfaces
export interface OperatorApprovalData {
  companyName: string;
  contactName: string;
}

export interface OperatorRejectionData {
  companyName: string;
  contactName: string;
  reason?: string;
}

export interface OperatorSuspensionData {
  companyName: string;
  contactName: string;
  reason?: string;
}

export interface OperatorReinstatementData {
  companyName: string;
  contactName: string;
}

export interface OperatorWelcomeData {
  companyName: string;
  contactName: string;
  email: string;
}

// Admin Notification Interfaces
export interface AdminNewJobData {
  jobId: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  vehicleType: string;
  maxBidAmount: string;
  operatorCount: number;
}

export interface NewOperatorRegistrationData {
  companyName: string;
  contactName: string;
  contactEmail: string;
  registrationNumber: string;
  operatorId: string;
}

export interface ManualJobAssignmentOperatorData {
  operatorName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  bidAmount: string;
}

export interface ManualJobAssignmentCustomerData {
  customerName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
}

// Customer Notification Interfaces
export interface CustomerDeactivationData {
  customerName: string;
  email: string;
  reason?: string;
}

export interface JobCompletionData {
  customerName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
}

export interface BookingModificationData {
  customerName: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  changes: string[];
}

// Document Expiry Notification Interfaces
export interface DocumentExpiryWarningData {
  operatorName: string;
  documentType: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export interface DocumentExpiredData {
  operatorName: string;
  documentType: string;
  expiredDate: string;
}

export interface AdminDocumentExpiryData {
  operatorName: string;
  operatorEmail: string;
  operatorId: string;
  documentType: string;
  expiryDate: string;
}

// Journey Reminder Interface
export interface JourneyReminderData {
  customerName: string;
  bookingReference: string;
  pickupDatetime: string;
  pickupAddress: string;
  dropoffAddress: string;
  driverName?: string;
  driverPhone?: string;
  vehicleRegistration?: string;
  hasDriverDetails: boolean;
}

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly resend: Resend | null = null;
  private readonly isConfigured: boolean;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@airporttransfer.com';

    if (apiKey && !apiKey.includes('your_')) {
      this.resend = new Resend(apiKey);
      this.isConfigured = true;
      this.logger.log('Resend configured successfully');
    } else {
      this.isConfigured = false;
      this.logger.warn('Resend not configured - emails will be logged only');
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(params: EmailParams): Promise<boolean> {
    if (!this.isConfigured || !this.resend) {
      this.logger.log(`[MOCK EMAIL] To: ${params.to}, Subject: ${params.subject}`);
      return true;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html || params.text || '',
      });
      this.logger.log(`Email sent to ${params.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${params.to}`, error);
      return false;
    }
  }

  /**
   * Send booking confirmation to customer
   */
  async sendBookingConfirmation(
    email: string,
    data: BookingConfirmationData,
  ): Promise<boolean> {
    const html = this.getBookingConfirmationHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Booking Confirmed - ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send driver details to customer
   */
  async sendDriverAssigned(
    email: string,
    data: DriverAssignedData,
  ): Promise<boolean> {
    const html = this.getDriverAssignedHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Driver Assigned - ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send new job alert to operator
   */
  async sendNewJobAlert(
    email: string,
    data: NewJobAlertData,
  ): Promise<boolean> {
    const html = this.getNewJobAlertHtml(data);

    return this.sendEmail({
      to: email,
      subject: 'New Job Available - Submit Your Bid',
      html,
    });
  }

  /**
   * Send bid won notification to operator
   */
  async sendBidWonNotification(
    email: string,
    data: BidWonData,
  ): Promise<boolean> {
    const html = this.getBidWonHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Congratulations! You Won Booking ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send job offer notification to operator (requires acceptance)
   */
  async sendJobOfferNotification(
    email: string,
    data: JobOfferData,
  ): Promise<boolean> {
    const html = this.getJobOfferHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Action Required: Confirm Job ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send booking cancellation notification to customer
   */
  async sendBookingCancellation(
    email: string,
    data: BookingCancellationData,
  ): Promise<boolean> {
    const html = this.getBookingCancellationHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Booking Cancelled - ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send job cancellation notification to operator
   */
  async sendOperatorJobCancellation(
    email: string,
    data: OperatorJobCancellationData,
  ): Promise<boolean> {
    const html = this.getOperatorJobCancellationHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Job Cancelled - ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send job modification notification to operator
   */
  async sendOperatorJobModification(
    email: string,
    data: OperatorJobModificationData,
  ): Promise<boolean> {
    const html = this.getOperatorJobModificationHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Job Updated - ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send welcome email to newly registered customer
   */
  async sendWelcomeEmail(
    email: string,
    data: WelcomeEmailData,
  ): Promise<boolean> {
    const html = this.getWelcomeEmailHtml(data);

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Total Travel Solution Group - Your Journey Starts Here!',
      html,
    });
  }

  /**
   * Send password reset OTP email
   */
  async sendPasswordResetOTP(
    email: string,
    data: PasswordResetOTPData,
  ): Promise<boolean> {
    const html = this.getPasswordResetOTPHtml(data);

    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request - Your OTP Code',
      html,
    });
  }

  /**
   * Send email verification OTP email
   */
  async sendEmailVerificationOTP(
    email: string,
    data: EmailVerificationOTPData,
  ): Promise<boolean> {
    const html = this.getEmailVerificationOTPHtml(data);

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Your OTP Code',
      html,
    });
  }

  // =========================================================================
  // OPERATOR LIFECYCLE EMAILS
  // =========================================================================

  /**
   * Send operator approval notification
   */
  async sendOperatorApproval(
    email: string,
    data: OperatorApprovalData,
  ): Promise<boolean> {
    const html = this.getOperatorApprovalHtml(data);

    return this.sendEmail({
      to: email,
      subject: '🎉 Your Operator Application Has Been Approved!',
      html,
    });
  }

  /**
   * Send operator rejection notification
   */
  async sendOperatorRejection(
    email: string,
    data: OperatorRejectionData,
  ): Promise<boolean> {
    const html = this.getOperatorRejectionHtml(data);

    return this.sendEmail({
      to: email,
      subject: 'Update on Your Operator Application',
      html,
    });
  }

  /**
   * Send operator suspension notification
   */
  async sendOperatorSuspension(
    email: string,
    data: OperatorSuspensionData,
  ): Promise<boolean> {
    const html = this.getOperatorSuspensionHtml(data);

    return this.sendEmail({
      to: email,
      subject: 'Important: Your Operator Account Has Been Suspended',
      html,
    });
  }

  /**
   * Send operator reinstatement notification
   */
  async sendOperatorReinstatement(
    email: string,
    data: OperatorReinstatementData,
  ): Promise<boolean> {
    const html = this.getOperatorReinstatementHtml(data);

    return this.sendEmail({
      to: email,
      subject: '✓ Your Operator Account Has Been Reinstated',
      html,
    });
  }

  /**
   * Send welcome email to newly registered operator
   */
  async sendOperatorWelcome(
    email: string,
    data: OperatorWelcomeData,
  ): Promise<boolean> {
    const html = this.getOperatorWelcomeHtml(data);

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Total Travel Solution Group - Operator Registration Received',
      html,
    });
  }

  // =========================================================================
  // ADMIN NOTIFICATION EMAILS
  // =========================================================================

  /**
   * Send notification to admin about new operator registration
   */
  async sendNewOperatorRegistrationToAdmin(
    email: string,
    data: NewOperatorRegistrationData,
  ): Promise<boolean> {
    const html = this.getNewOperatorRegistrationHtml(data);

    return this.sendEmail({
      to: email,
      subject: `New Operator Registration: ${data.companyName}`,
      html,
    });
  }

  /**
   * Send new job notification to admin
   */
  async sendNewJobToAdmin(email: string, data: AdminNewJobData): Promise<boolean> {
    const html = this.getAdminNewJobHtml(data);

    return this.sendEmail({
      to: email,
      subject: `New Job Created: ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send manual job assignment notification to operator
   */
  async sendManualJobAssignmentToOperator(
    email: string,
    data: ManualJobAssignmentOperatorData,
  ): Promise<boolean> {
    const html = this.getManualJobAssignmentOperatorHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Job Assigned: ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send manual job assignment notification to customer
   */
  async sendManualJobAssignmentToCustomer(
    email: string,
    data: ManualJobAssignmentCustomerData,
  ): Promise<boolean> {
    const html = this.getManualJobAssignmentCustomerHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Driver Being Assigned: ${data.bookingReference}`,
      html,
    });
  }

  // =========================================================================
  // CUSTOMER NOTIFICATION EMAILS
  // =========================================================================

  /**
   * Send customer account deactivation notification
   */
  async sendCustomerDeactivation(
    email: string,
    data: CustomerDeactivationData,
  ): Promise<boolean> {
    const html = this.getCustomerDeactivationHtml(data);

    return this.sendEmail({
      to: email,
      subject: 'Your Account Has Been Deactivated',
      html,
    });
  }

  /**
   * Send job completion notification to customer
   */
  async sendJobCompletion(
    email: string,
    data: JobCompletionData,
  ): Promise<boolean> {
    const html = this.getJobCompletionHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Journey Completed: ${data.bookingReference}`,
      html,
    });
  }

  /**
   * Send booking modification confirmation to customer
   */
  async sendBookingModification(
    email: string,
    data: BookingModificationData,
  ): Promise<boolean> {
    const html = this.getBookingModificationHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Booking Updated: ${data.bookingReference}`,
      html,
    });
  }

  // =========================================================================
  // DOCUMENT EXPIRY EMAILS
  // =========================================================================

  /**
   * Send document expiry warning to operator
   */
  async sendDocumentExpiryWarning(
    email: string,
    data: DocumentExpiryWarningData,
  ): Promise<boolean> {
    const html = this.getDocumentExpiryWarningHtml(data);

    return this.sendEmail({
      to: email,
      subject: `⚠️ Document Expiring Soon: ${data.documentType}`,
      html,
    });
  }

  /**
   * Send document expired notification to operator
   */
  async sendDocumentExpired(
    email: string,
    data: DocumentExpiredData,
  ): Promise<boolean> {
    const html = this.getDocumentExpiredHtml(data);

    return this.sendEmail({
      to: email,
      subject: `🚨 Document Expired: ${data.documentType}`,
      html,
    });
  }

  /**
   * Send document expiry notification to admin
   */
  async sendDocumentExpiryToAdmin(
    email: string,
    data: AdminDocumentExpiryData,
  ): Promise<boolean> {
    const html = this.getAdminDocumentExpiryHtml(data);

    return this.sendEmail({
      to: email,
      subject: `Operator Document Expiry: ${data.operatorName}`,
      html,
    });
  }

  // =========================================================================
  // JOURNEY REMINDER EMAILS
  // =========================================================================

  /**
   * Send journey reminder to customer (24 hours before pickup)
   */
  async sendJourneyReminder(
    email: string,
    data: JourneyReminderData,
  ): Promise<boolean> {
    const html = this.getJourneyReminderHtml(data);

    return this.sendEmail({
      to: email,
      subject: `⏰ Reminder: Your Journey Tomorrow - ${data.bookingReference}`,
      html,
    });
  }

  // =========================================================================
  // REUSABLE EMAIL COMPONENTS
  // =========================================================================

  /**
   * Get professional email footer with contact info and social links
   */
  private getEmailFooter(): string {
    const currentYear = new Date().getFullYear();

    return `
      <!-- Footer -->
      <tr>
        <td style="background-color: #f8fafc; padding: 30px 20px; text-align: center; border-top: 1px solid #e2e8f0;">

          <!-- Brand & Tagline -->
          <div style="margin-bottom: 20px;">
            <h2 style="color: #0D9488; font-size: 18px; font-weight: 700; margin: 0 0 4px 0; letter-spacing: 0.3px;">
              TOTAL TRAVEL SOLUTION GROUP
            </h2>
            <p style="color: #64748b; font-size: 12px; margin: 0; font-style: italic;">
              Click.Book.Travel
            </p>
          </div>

          <!-- WhatsApp Badge -->
          <div style="margin-bottom: 18px; text-align: center;">
            <a href="https://wa.me/443301337044"
              target="_blank"
              style="
                background-color: #d1fae5;
                color: #065f46;
                font-size: 11px;
                font-weight: 600;
                padding: 6px 14px;
                border-radius: 20px;
                display: inline-block;
                text-decoration: none;
              ">
              WhatsApp Support 24/7
            </a>
          </div>

          <!-- Social Media Icons -->
          <div style="margin: 18px 0; text-align: center;">
            <a href="https://www.facebook.com/profile.php?id=61586753652984"
              style="display: inline-block; margin: 0 8px;">
              <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png"
                  width="18" height="18" alt="Facebook"
                  style="display: block; border: 0;">
            </a>

            <a href="https://x.com/TTS_Group"
              style="display: inline-block; margin: 0 8px;">
              <img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png"
                  width="18" height="18" alt="X"
                  style="display: block; border: 0;">
            </a>

            <a href="https://www.instagram.com/ttsg.2025/"
              style="display: inline-block; margin: 0 8px;">
              <img src="https://cdn-icons-png.flaticon.com/512/733/733558.png"
                  width="18" height="18" alt="Instagram"
                  style="display: block; border: 0;">
            </a>

            <a href="https://www.linkedin.com/company/totaltravelsolutiongroup/"
              style="display: inline-block; margin: 0 8px;">
              <img src="https://cdn-icons-png.flaticon.com/512/733/733561.png"
                  width="18" height="18" alt="LinkedIn"
                  style="display: block; border: 0;">
            </a>
          </div>

          <!-- Divider -->
          <div style="border-top: 1px solid #e2e8f0; margin: 20px auto; max-width: 450px;"></div>

          <!-- Company Info -->
          <p style="color: #64748b; font-size: 11px; margin: 0 0 6px 0; line-height: 1.6;">
            <strong style="color: #475569;">Total Travel Solution Group LTD</strong><br>
            Registered office: Bury Park, Luton, England, LU1 1HE.<br>
            Registered in England and Wales Registered number: 16910276.<br>
            E: <a href="mailto:customerservice@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none;">customerservice@totaltravelsolutiongroup.com</a> T: <a href="tel:+443301337044" style="color: #0D9488; text-decoration: none;">+44 33 0133 7044</a>
          </p>

          <!-- Copyright -->
          <p style="color: #94a3b8; font-size: 11px; margin: 0 0 15px 0;">
            © ${currentYear} Total Travel Solution Group. All rights reserved.
          </p>

          <!-- Confidentiality Notice -->
          <div style="background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; padding: 10px 12px; margin: 0 auto; max-width: 480px; text-align: left;">
            <p style="color: #78350f; font-size: 10px; margin: 0; line-height: 1.5;">
              <strong style="color: #92400e;">⚠️ Confidential:</strong> This email is confidential and intended solely for the addressee. If received in error, please delete immediately and notify the sender. Unauthorized use is prohibited.
            </p>
          </div>

        </td>
      </tr>
    `;
  }

  // =========================================================================
  // HTML EMAIL TEMPLATES
  // =========================================================================

  private getBookingConfirmationHtml(data: BookingConfirmationData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Booking Confirmed!
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your Journey is All Set!</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Dear ${data.customerName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Thank you for choosing Total Travel Solution Group! We're pleased to confirm your reservation. Here are the details of your journey:
                    </p>

                    <!-- Booking Details Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Booking Reference
                      </p>
                      <p style="color: #0D9488; font-size: 28px; font-weight: 700; margin: 0 0 20px 0; font-family: 'Courier New', monospace;">
                        ${data.bookingReference}
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Pickup Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Drop-off Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Date & Time:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Vehicle Type:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.vehicleType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Passengers:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.passengerCount}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Total Price:</strong></td>
                          <td style="padding: 8px 0; color: #0D9488; font-size: 16px; font-weight: 700;">${data.totalPrice}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                      We appreciate your trust in us and look forward to serving you!
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Customer Support</strong>
                    </p>
                  </td>
                </tr>

                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getDriverAssignedHtml(data: DriverAssignedData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Driver Assigned</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Driver Assigned!
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your Driver is Ready for Your Journey</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Dear ${data.customerName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Great news! A driver has been assigned to your booking. Here are the details:
                    </p>

                    <!-- Booking Reference -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 0 0 20px 0; text-align: center;">
                      <p style="color: #475569; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                      <p style="color: #0D9488; font-size: 20px; font-weight: 700; margin: 0; font-family: 'Courier New', monospace;">${data.bookingReference}</p>
                    </div>

                    <!-- Driver Details Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Driver Details
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 40%;"><strong>Driver Name:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.driverName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Phone:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">
                            <a href="tel:${data.driverPhone}" style="color: #0D9488; text-decoration: none; font-weight: 600;">${data.driverPhone}</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Vehicle Registration:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600;">${data.vehicleRegistration}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                      Your driver will contact you if needed. We wish you a safe journey!
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Customer Support</strong>
                    </p>
                  </td>
                </tr>

                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getNewJobAlertHtml(data: NewJobAlertData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Job Available</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      New Job Available
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">A New Opportunity is Waiting for You</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.operatorName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Exciting news! A new job is available in your service area. Review the details below and submit your bid!
                    </p>

                    <!-- Job Details Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Job Details
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 35%;"><strong>Pickup Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Drop-off Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Date & Time:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Vehicle Type:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.vehicleType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Maximum Bid:</strong></td>
                          <td style="padding: 8px 0; color: #0D9488; font-size: 16px; font-weight: 700;">${data.maxBidAmount}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/jobs" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Submit Your Bid
                      </a>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                      Don't miss out! Submit your competitive bid now to win this job.
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Customer Support</strong>
                    </p>
                  </td>
                </tr>

                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getBidWonHtml(data: BidWonData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Congratulations - Bid Won</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Congratulations!
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your Bid Was Successful</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.operatorName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Great news! Your bid was successful, and you have been assigned this job. Please submit driver details as soon as possible.
                    </p>

                    <!-- Booking Reference -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 0 0 20px 0; text-align: center;">
                      <p style="color: #475569; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                      <p style="color: #0D9488; font-size: 24px; font-weight: 700; margin: 0; font-family: 'Courier New', monospace;">${data.bookingReference}</p>
                    </div>

                    <!-- Job Details Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Job Details
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 30%;"><strong>Pickup Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Drop-off Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Date & Time:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Your Bid:</strong></td>
                          <td style="padding: 8px 0; color: #0D9488; font-size: 16px; font-weight: 700;">${data.bidAmount}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/jobs" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Submit Driver Details
                      </a>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Customer Support</strong>
                    </p>
                  </td>
                </tr>

                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getJobOfferHtml(data: JobOfferData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Action Required - Confirm Job</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Action Required
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Confirm This Job to Secure It</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.operatorName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                      Your bid was the lowest! ⚠️ Please confirm acceptance of this job by quoting the booking reference:
                    </p>

                    <!-- Booking Reference - Highlighted -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 0 0 15px 0; text-align: center;">
                      <p style="color: #475569; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                      <p style="color: #0D9488; font-size: 24px; font-weight: 700; margin: 0; font-family: 'Courier New', monospace;">${data.bookingReference}</p>
                    </div>

                    <!-- Deadline Warning -->
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                      <strong>Deadline to Accept:</strong> ${data.acceptanceDeadline}
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                      If you do not confirm by this time, the job will be offered to another operator.
                    </p>

                    <!-- Job Details Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Job Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 30%;"><strong>Pickup Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Drop-off Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Date & Time:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Your Bid:</strong></td>
                          <td style="padding: 8px 0; color: #0D9488; font-size: 16px; font-weight: 700;">${data.bidAmount}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Customer Support</strong>
                    </p>
                  </td>
                </tr>

                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getBookingCancellationHtml(data: BookingCancellationData): string {
    const refundMessage = data.refundPercent > 0
      ? `<tr>
           <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Refund Amount:</strong></td>
           <td style="padding: 8px 0; color: #0D9488; font-size: 16px; font-weight: 700;">${data.refundAmount} (${data.refundPercent}%)</td>
         </tr>`
      : `<tr>
           <td colspan="2" style="padding: 8px 0; color: #E11D48; font-size: 14px;">No refund applicable based on cancellation policy</td>
         </tr>`;

    const reasonMessage = data.cancellationReason
      ? `<tr>
           <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Reason:</strong></td>
           <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.cancellationReason}</td>
         </tr>`
      : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Cancelled</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Booking Cancelled
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">We're Sorry to See You Go</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Dear ${data.customerName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Your booking has been cancelled. Here are the details:
                    </p>

                    <!-- Booking Details Box -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">Cancelled Booking Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 35%;"><strong>Reference:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px; font-family: 'Courier New', monospace;">${data.bookingReference}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Pickup Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Drop-off Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Original Date:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        ${reasonMessage}
                      </table>
                    </div>

                    <!-- Refund Information Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Refund Information
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        ${refundMessage}
                      </table>
                      <p style="color: #64748b; font-size: 13px; margin: 15px 0 0 0;">
                        Refunds are processed within 5-10 business days.
                      </p>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Customer Support</strong>
                    </p>
                  </td>
                </tr>

                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getOperatorJobCancellationHtml(data: OperatorJobCancellationData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Cancelled</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Job Cancelled
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Customer Has Cancelled This Booking</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.operatorName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Unfortunately, the following job has been cancelled by the customer:
                    </p>

                    <!-- Job Details Box -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">Cancelled Job Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 35%;"><strong>Reference:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px; font-family: 'Courier New', monospace;">${data.bookingReference}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Pickup Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Drop-off Location:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Original Date:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- Info Notice -->
                    <div style="background-color: #f0fdfa; border: 1px solid #0D9488; border-radius: 8px; padding: 15px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0; line-height: 1.5;">
                        <strong>✓ No Action Required</strong> You don't need to do anything for this booking. Thank you for your understanding.
                      </p>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Customer Support</strong>
                    </p>
                  </td>
                </tr>

                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getOperatorJobModificationHtml(data: OperatorJobModificationData): string {
    const changesHtml = data.changes.map(change =>
      `<li style="color: #334155; font-size: 14px; line-height: 1.8;">${change}</li>`
    ).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Updated</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Job Updated
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Customer has modified this booking</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.operatorName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      The customer has made changes to one of your assigned jobs. Please review the updated details below:
                    </p>

                    <!-- Changes Alert Box -->
                    <div style="background-color: #f0fdfa; border: 1px solid #0D9488; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">⚠️ What Changed:</p>
                      <ul style="margin: 0; padding-left: 20px;">
                        ${changesHtml}
                      </ul>
                    </div>

                    <!-- Updated Job Details Box -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">📋 Updated Job Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 35%;"><strong>Reference:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px; font-family: 'Courier New', monospace;">${data.bookingReference}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Pickup:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Dropoff:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Pickup Date:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Vehicle Type:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.vehicleType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Passengers:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.passengerCount}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Luggage:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.luggageCount}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- Action Required Notice -->
                    <div style="background-color: #f0fdfa; border: 1px solid #0D9488; border-radius: 8px; padding: 15px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0; line-height: 1.5;">
                        <strong>⚠️ Action Required</strong><br>
                        Please update your schedule and ensure you're prepared for the modified booking details.
                      </p>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailHtml(data: WelcomeEmailData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Total Travel Solution Group</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Total Travel Solution Group
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your Trusted Online Booking Platform</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #0D9488; margin: 0 0 20px 0; font-size: 24px; text-align: center;">
                      Welcome Aboard, ${data.firstName}!
                    </h2>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Thank you for joining Total Travel Solution Group. We're excited to be your partner for all your transfer needs!
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Your account has been successfully created with the email: <strong>${data.email}</strong>
                    </p>

                <!-- Features Section -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px;">
                      <h3 style="color: #0D9488; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
                        Why Choose Us?
                      </h3>

                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 12px 0;">
                            <p style="color: #334155; font-size: 15px; margin: 0; line-height: 1.6;">
                              <strong style="color: #0D9488;">• Reliable & Professional Service</strong><br>
                              <span style="color: #475569; font-size: 14px;">Licensed drivers and premium vehicles for your comfort and safety.</span>
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0;">
                            <p style="color: #334155; font-size: 15px; margin: 0; line-height: 1.6;">
                              <strong style="color: #0D9488;">• Best Value Pricing</strong><br>
                              <span style="color: #475569; font-size: 14px;">Transparent pricing with no hidden fees. Get the best rates for your journey.</span>
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0;">
                            <p style="color: #334155; font-size: 15px; margin: 0; line-height: 1.6;">
                              <strong style="color: #0D9488;">• Real-Time Updates</strong><br>
                              <span style="color: #475569; font-size: 14px;">Track your booking and receive instant notifications via email & SMS.</span>
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0;">
                            <p style="color: #334155; font-size: 15px; margin: 0; line-height: 1.6;">
                              <strong style="color: #0D9488;">• 24/7 Customer Support</strong><br>
                              <span style="color: #475569; font-size: 14px;">Our support team is always available to assist you with any questions.</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 30px 40px 30px; text-align: center;">
                    <a href="${frontendUrl}/bookings/new" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Book Your First Transfer
                    </a>
                  </td>
                </tr>

                <!-- Footer -->
                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getPasswordResetOTPHtml(data: PasswordResetOTPData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Password Reset
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your OTP Code is Ready</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.firstName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      We received a request to reset your password. Use the OTP code below to proceed:
                    </p>

                    <!-- OTP Code Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Your OTP Code
                      </p>
                      <p style="color: #0D9488; font-size: 42px; font-weight: 700; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${data.otp}
                      </p>
                      <p style="color: #64748b; font-size: 13px; margin: 15px 0 0 0;">
                        This code expires in 10 minutes.
                      </p>
                    </div>

                    <!-- Security Notice -->
                    <div style="background-color: #f0fdfa; border: 1px solid #0D9488; border-radius: 8px; padding: 15px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0; line-height: 1.5;">
                        <strong>Security Notice:</strong> If you didn't request this, please ignore this email. Your account is safe.
                      </p>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>The Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getEmailVerificationOTPHtml(data: EmailVerificationOTPData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Email Verification
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Verify Your Email - Complete Your Account Setup</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.firstName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Thank you for signing up! Please verify your email address using the OTP code below:
                    </p>

                    <!-- OTP Code Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Your Verification Code
                      </p>
                      <p style="color: #0D9488; font-size: 42px; font-weight: 700; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${data.otp}
                      </p>
                      <p style="color: #64748b; font-size: 13px; margin: 15px 0 0 0;">
                        This code expires in 15 minutes.
                      </p>
                    </div>

                    <!-- Next Steps -->
                    <div style="background-color: #f0fdfa; border: 1px solid #0D9488; border-radius: 8px; padding: 15px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0; line-height: 1.5;">
                        <strong>Next Steps:</strong> Enter this code in the verification field to complete your account setup and start booking transfers.
                      </p>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>The Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  // =========================================================================
  // NEW EMAIL TEMPLATES - OPERATOR LIFECYCLE
  // =========================================================================

  private getOperatorApprovalHtml(data: OperatorApprovalData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Approved</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">🎉 Application Approved!</h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Welcome to our operator network</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.contactName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Great news! Your operator application for <strong>${data.companyName}</strong> has been approved. You can now start bidding on jobs and growing your business with us.
                    </p>
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">What You Can Do Now</p>
                      <ul style="color: #334155; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Browse and bid on available jobs in your service areas</li>
                        <li>Manage your fleet and driver details</li>
                        <li>Track your earnings and payouts</li>
                        <li>Build your reputation with completed jobs</li>
                      </ul>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/jobs" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">Start Bidding</a>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getOperatorRejectionHtml(data: OperatorRejectionData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Update</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #64748b; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">Application Update</h1>
                    <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">We've reviewed your application</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.contactName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Thank you for your interest in joining Total Travel Solution Group. After careful review, we regret to inform you that your operator application for <strong>${data.companyName}</strong> has not been approved at this time.
                    </p>
                    ${data.reason ? `
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #991b1b; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">Reason:</p>
                      <p style="color: #7f1d1d; font-size: 14px; margin: 0;">${data.reason}</p>
                    </div>
                    ` : ''}
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      If you believe this decision was made in error or would like to provide additional information, please contact our support team.
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getOperatorSuspensionHtml(data: OperatorSuspensionData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Suspended</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #dc2626; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">⚠️ Account Suspended</h1>
                    <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">Important notice about your operator account</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.contactName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      We regret to inform you that your operator account for <strong>${data.companyName}</strong> has been suspended. During this suspension, you will not be able to bid on new jobs or accept job offers.
                    </p>
                    ${data.reason ? `
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #991b1b; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">Reason for Suspension:</p>
                      <p style="color: #7f1d1d; font-size: 14px; margin: 0;">${data.reason}</p>
                    </div>
                    ` : ''}
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">What happens now?</p>
                      <ul style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>You cannot bid on or accept new jobs</li>
                        <li>Any pending jobs must still be completed</li>
                        <li>Contact support to resolve this issue</li>
                      </ul>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getOperatorReinstatementHtml(data: OperatorReinstatementData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Reinstated</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">✓ Account Reinstated</h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Welcome back to our operator network</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.contactName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Great news! Your operator account for <strong>${data.companyName}</strong> has been reinstated. You can now resume bidding on jobs and accepting job offers.
                    </p>
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Account is Active</p>
                      <ul style="color: #334155; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Browse and bid on available jobs</li>
                        <li>Accept job offers from our platform</li>
                        <li>Continue building your reputation</li>
                      </ul>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/jobs" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">View Available Jobs</a>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getOperatorWelcomeHtml(data: OperatorWelcomeData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Total Travel Solution Group</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">Welcome, ${data.contactName}!</h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your operator registration has been received</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.contactName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Thank you for registering <strong>${data.companyName}</strong> with Total Travel Solution Group. We're excited to have you join our operator network!
                    </p>
                    <div style="background-color: #fef9c3; border: 2px solid #eab308; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #854d0e; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">⏳ Pending Approval</p>
                      <p style="color: #713f12; font-size: 14px; line-height: 1.6; margin: 0;">
                        Your application is currently under review by our team. This process typically takes 1-2 business days. You'll receive an email once your account has been approved.
                      </p>
                    </div>
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">In the meantime, make sure you have:</p>
                      <ul style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Uploaded all required documents</li>
                        <li>Completed your company profile</li>
                        <li>Added your fleet and service areas</li>
                      </ul>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/profile" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">Complete Your Profile</a>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getAdminNewJobHtml(data: AdminNewJobData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Job Created</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">New Job Created</h1>
                    <p style="color: #ccfbf1; margin: 10px 0 0 0; font-size: 16px;">A new booking has been paid and a job is now live</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">A new job has been created and broadcast to <strong>${data.operatorCount} operator(s)</strong>.</p>
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 160px;">Booking Reference:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.bookingReference}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Pickup:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Dropoff:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Pickup Time:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Vehicle Type:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.vehicleType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Max Bid Amount:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.maxBidAmount}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Operators Notified:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.operatorCount}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/admin/jobs/${data.jobId}" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">View Job</a>
                    </div>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getNewOperatorRegistrationHtml(data: NewOperatorRegistrationData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Operator Registration</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #3b82f6; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">📋 New Operator Registration</h1>
                    <p style="color: #dbeafe; margin: 10px 0 0 0; font-size: 16px;">Action required: Review and approve</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">A new operator has registered on the platform and requires approval:</p>
                    <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 140px;">Company Name:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.companyName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Contact Name:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.contactName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Contact Email:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.contactEmail}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Registration No:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.registrationNumber}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/admin/operators/${data.operatorId}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">Review Application</a>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">Please review the operator's documents and profile before approving or rejecting the application.</p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getManualJobAssignmentOperatorHtml(data: ManualJobAssignmentOperatorData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Assigned to You</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">🚗 Job Assigned</h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">A job has been assigned to you by admin</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.operatorName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      A job has been manually assigned to you. Please review the details below and submit driver details as soon as possible.
                    </p>
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Job Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 100px;">Reference:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.bookingReference}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Pickup:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Drop-off:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date/Time:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Amount:</td>
                          <td style="padding: 8px 0; color: #0D9488; font-size: 16px; font-weight: 700;">${data.bidAmount}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/jobs" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">View Job Details</a>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getManualJobAssignmentCustomerHtml(data: ManualJobAssignmentCustomerData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Driver Being Assigned</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">🚗 Driver Being Assigned</h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">We're assigning a driver to your booking</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.customerName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Great news! We're in the process of assigning a driver to your booking. You'll receive the driver details shortly before your pickup time.
                    </p>
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Booking</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 100px;">Reference:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.bookingReference}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Pickup:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Drop-off:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date/Time:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.pickupDatetime}</td>
                        </tr>
                      </table>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; padding: 15px; background-color: #f8fafc; border-radius: 6px;">
                      <strong>What's next?</strong> Once the driver is confirmed, you'll receive another email with their name, phone number, and vehicle details.
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getCustomerDeactivationHtml(data: CustomerDeactivationData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Deactivated</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #64748b; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">Account Deactivated</h1>
                    <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Important notice about your account</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.customerName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      We're writing to inform you that your account (${data.email}) has been deactivated. You will no longer be able to log in or make new bookings.
                    </p>
                    ${data.reason ? `
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #991b1b; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">Reason:</p>
                      <p style="color: #7f1d1d; font-size: 14px; margin: 0;">${data.reason}</p>
                    </div>
                    ` : ''}
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      If you believe this was done in error or would like to appeal this decision, please contact our support team.
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getJobCompletionHtml(data: JobCompletionData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Journey Completed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">✓ Journey Completed</h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Thank you for traveling with us!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.customerName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Your journey has been completed successfully. We hope you had a pleasant experience!
                    </p>
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Trip Summary</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 100px;">Reference:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.bookingReference}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">From:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">To:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date/Time:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="background-color: #fef9c3; border: 1px solid #eab308; border-radius: 8px; padding: 20px; margin: 0 0 25px 0; text-align: center;">
                      <p style="color: #854d0e; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">⭐ Rate Your Experience</p>
                      <p style="color: #713f12; font-size: 14px; margin: 0 0 15px 0;">Your feedback helps us improve our service and recognize our best drivers.</p>
                      <a href="${frontendUrl}/bookings/${data.bookingReference}/review" style="display: inline-block; background-color: #eab308; color: #713f12; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold; font-size: 14px;">Leave a Review</a>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getBookingModificationHtml(data: BookingModificationData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Updated</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">📝 Booking Updated</h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your booking details have been modified</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.customerName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Your booking <strong>${data.bookingReference}</strong> has been updated. Please review the changes below.
                    </p>
                    <div style="background-color: #fef9c3; border: 2px solid #eab308; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #854d0e; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Changes Made</p>
                      <ul style="color: #713f12; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        ${data.changes.map(change => `<li>${change}</li>`).join('')}
                      </ul>
                    </div>
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Current Booking Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 100px;">Reference:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.bookingReference}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Pickup:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Drop-off:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date/Time:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.pickupDatetime}</td>
                        </tr>
                      </table>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getDocumentExpiryWarningHtml(data: DocumentExpiryWarningData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const urgencyColor = data.daysUntilExpiry <= 7 ? '#dc2626' : '#eab308';
    const urgencyBg = data.daysUntilExpiry <= 7 ? '#fef2f2' : '#fef9c3';
    const urgencyBorder = data.daysUntilExpiry <= 7 ? '#fecaca' : '#fcd34d';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Expiring Soon</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: ${urgencyColor}; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">⚠️ Document Expiring Soon</h1>
                    <p style="color: ${data.daysUntilExpiry <= 7 ? '#fecaca' : '#fef9c3'}; margin: 10px 0 0 0; font-size: 16px;">Action required to maintain your operator status</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.operatorName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      This is a reminder that one of your documents is expiring soon. Please upload a renewed document to avoid any disruption to your ability to accept jobs.
                    </p>
                    <div style="background-color: ${urgencyBg}; border: 2px solid ${urgencyBorder}; border-radius: 12px; padding: 25px; margin: 0 0 25px 0; text-align: center;">
                      <p style="color: ${urgencyColor}; font-size: 48px; margin: 0 0 10px 0; font-weight: 700;">${data.daysUntilExpiry}</p>
                      <p style="color: ${urgencyColor}; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Days Until Expiry</p>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Document:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.documentType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Expiry Date:</td>
                          <td style="padding: 8px 0; color: ${urgencyColor}; font-size: 14px; font-weight: 600;">${data.expiryDate}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/documents" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">Upload New Document</a>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; padding: 15px; background-color: #f8fafc; border-radius: 6px;">
                      <strong>Important:</strong> If your document expires without renewal, your operator account may be suspended until a valid document is uploaded.
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getDocumentExpiredHtml(data: DocumentExpiredData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Expired</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #dc2626; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">🚨 Document Expired</h1>
                    <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">Immediate action required</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${data.operatorName},</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Your document has expired. To continue accepting jobs on our platform, please upload a renewed document immediately.
                    </p>
                    <div style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; padding: 25px; margin: 0 0 25px 0; text-align: center;">
                      <p style="color: #dc2626; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Expired Document</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Document:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.documentType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Expired On:</td>
                          <td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">${data.expiredDate}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="background-color: #fef9c3; border: 1px solid #eab308; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #854d0e; font-size: 14px; margin: 0; font-weight: 600;">⚠️ Your account may be suspended if a valid document is not uploaded soon.</p>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/documents" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">Upload New Document Now</a>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Customer Support</strong></p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getAdminDocumentExpiryHtml(data: AdminDocumentExpiryData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Operator Document Expiry Notice</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">
                <tr>
                  <td style="background-color: #f97316; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">📋 Document Expiry Alert</h1>
                    <p style="color: #fed7aa; margin: 10px 0 0 0; font-size: 16px;">Operator document requires attention</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">An operator's document is expiring or has expired and may require admin action:</p>
                    <div style="background-color: #fff7ed; border: 2px solid #f97316; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px;">Operator:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.operatorName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.operatorEmail}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Document:</td>
                          <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.documentType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Expiry Date:</td>
                          <td style="padding: 8px 0; color: #ea580c; font-size: 14px; font-weight: 600;">${data.expiryDate}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/admin/operators/${data.operatorId}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">View Operator Details</a>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">You may need to contact the operator or suspend their account if the document is not renewed.</p>
                  </td>
                </tr>
                ${this.getEmailFooter()}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getJourneyReminderHtml(data: JourneyReminderData): string {
    const driverDetailsSection = data.hasDriverDetails
      ? `
                    <!-- Driver Details Box -->
                    <div style="background-color: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        🚗 Your Driver Details
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 40%;"><strong>Driver Name:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.driverName || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Phone:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">
                            <a href="tel:${data.driverPhone || ''}" style="color: #0D9488; text-decoration: none; font-weight: 600;">${data.driverPhone || 'N/A'}</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Vehicle Reg:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600;">${data.vehicleRegistration || 'N/A'}</td>
                        </tr>
                      </table>
                    </div>
      `
      : `
                    <!-- Driver Details Pending Box -->
                    <div style="background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #b45309; font-size: 14px; margin: 0; font-weight: 600;">
                        ⏳ Driver details will be shared once confirmed. You will receive another email with driver information.
                      </p>
                    </div>
      `;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Journey Reminder</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #0D9488; padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      ⏰ Journey Reminder
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your trip is tomorrow!</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Dear ${data.customerName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      This is a friendly reminder that your journey is scheduled for <strong>tomorrow</strong>. Please review your booking details below:
                    </p>

                    <!-- Booking Reference -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 0 0 20px 0; text-align: center;">
                      <p style="color: #475569; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                      <p style="color: #0D9488; font-size: 20px; font-weight: 700; margin: 0; font-family: 'Courier New', monospace;">${data.bookingReference}</p>
                    </div>

                    <!-- Journey Details Box -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">📍 Journey Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 30%;"><strong>Pickup Time:</strong></td>
                          <td style="padding: 8px 0; color: #0D9488; font-size: 14px; font-weight: 600;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Pickup:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Drop-off:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                      </table>
                    </div>

                    ${driverDetailsSection}

                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      Please ensure you are ready at the pickup location on time. Your driver will be waiting for you.
                    </p>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>The Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                ${this.getEmailFooter()}

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
