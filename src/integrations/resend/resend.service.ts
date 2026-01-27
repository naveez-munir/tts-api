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

  // HTML Email Templates
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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      ✓ Booking Confirmed
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your journey is all set!</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Dear ${data.customerName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Thank you for booking with Total Travel Solution Group. Your reservation has been confirmed. Here are your journey details:
                    </p>

                    <!-- Booking Details Box -->
                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Booking Reference
                      </p>
                      <p style="color: #0D9488; font-size: 28px; font-weight: 700; margin: 0 0 20px 0; font-family: 'Courier New', monospace;">
                        ${data.bookingReference}
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Pickup:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Dropoff:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Date & Time:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Vehicle:</strong></td>
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

                    <!-- Next Steps -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
                      <p style="color: #475569; font-size: 15px; font-weight: 600; margin: 0 0 10px 0;">
                        📱 What happens next?
                      </p>
                      <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
                        We will send you driver details once a driver has been assigned to your booking. You'll receive another email with driver name, phone number, and vehicle registration.
                      </p>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Thank you for choosing us!<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      🚗 Driver Assigned
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your driver is ready for your journey</p>
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
                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
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
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Vehicle Reg:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600;">${data.vehicleRegistration}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- Pickup Details Box -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">📍 Pickup Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 6px 0; color: #475569; font-size: 14px; width: 30%;"><strong>Time:</strong></td>
                          <td style="padding: 6px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #475569; font-size: 14px;"><strong>Address:</strong></td>
                          <td style="padding: 6px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      Your driver will contact you if needed. Have a safe journey!
                    </p>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      📋 New Job Available
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">A new opportunity is waiting for you</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.operatorName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      A new job is available in your service area. Review the details below and submit your bid!
                    </p>

                    <!-- Job Details Box -->
                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Job Details
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 35%;"><strong>Pickup:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Dropoff:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Date & Time:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Vehicle Required:</strong></td>
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
                      <a href="${frontendUrl}/operator/jobs" style="display: inline-block; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(13, 148, 136, 0.3);">
                        Submit Your Bid
                      </a>
                    </div>

                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
                      Don't miss out! Submit your competitive bid now to win this job.
                    </p>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      🎉 Congratulations!
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your bid was successful</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.operatorName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Great news! Your bid was successful and you have been assigned this job. Please submit driver details as soon as possible.
                    </p>

                    <!-- Booking Reference -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 0 0 20px 0; text-align: center;">
                      <p style="color: #475569; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                      <p style="color: #0D9488; font-size: 24px; font-weight: 700; margin: 0; font-family: 'Courier New', monospace;">${data.bookingReference}</p>
                    </div>

                    <!-- Job Details Box -->
                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #0D9488; border-radius: 12px; padding: 25px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Job Details
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px; width: 30%;"><strong>Pickup:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Dropoff:</strong></td>
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
                      <a href="${frontendUrl}/operator/jobs" style="display: inline-block; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(13, 148, 136, 0.3);">
                        Submit Driver Details
                      </a>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private getJobOfferHtml(data: JobOfferData): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      ⏰ Action Required
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Confirm this job to secure it</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.operatorName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Your bid was the lowest! Please confirm acceptance of this job by quoting the booking reference:
                    </p>

                    <!-- Booking Reference - Highlighted -->
                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #0D9488; border-radius: 12px; padding: 20px; margin: 0 0 20px 0; text-align: center;">
                      <p style="color: #475569; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                      <p style="color: #0D9488; font-size: 28px; font-weight: 700; margin: 0; font-family: 'Courier New', monospace;">${data.bookingReference}</p>
                    </div>

                    <!-- Job Details Box -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">📋 Job Details</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 6px 0; color: #475569; font-size: 14px; width: 30%;"><strong>Pickup:</strong></td>
                          <td style="padding: 6px 0; color: #334155; font-size: 14px;">${data.pickupAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #475569; font-size: 14px;"><strong>Dropoff:</strong></td>
                          <td style="padding: 6px 0; color: #334155; font-size: 14px;">${data.dropoffAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #475569; font-size: 14px;"><strong>Date & Time:</strong></td>
                          <td style="padding: 6px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #475569; font-size: 14px;"><strong>Your Bid:</strong></td>
                          <td style="padding: 6px 0; color: #0D9488; font-size: 16px; font-weight: 700;">${data.bidAmount}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- Deadline Warning Box -->
                    <div style="background-color: #fef2f2; border-left: 4px solid #E11D48; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
                      <p style="color: #991b1b; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">
                        ⚠️ Deadline to Accept: ${data.acceptanceDeadline}
                      </p>
                      <p style="color: #991b1b; font-size: 13px; margin: 0; line-height: 1.5;">
                        If you do not confirm by this time, the job will be offered to another operator.
                      </p>
                    </div>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${frontendUrl}/operator/jobs" style="display: inline-block; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(13, 148, 136, 0.3);">
                        Confirm Job Now
                      </a>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Booking Cancelled
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">We're sorry to see you go</p>
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
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">📋 Cancelled Booking Details</p>
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
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Original Date:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                        ${reasonMessage}
                      </table>
                    </div>

                    <!-- Refund Information Box -->
                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #0D9488; border-radius: 12px; padding: 20px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        💰 Refund Information
                      </p>
                      <table style="width: 100%; border-collapse: collapse;">
                        ${refundMessage}
                      </table>
                      <p style="color: #64748b; font-size: 13px; margin: 15px 0 0 0;">
                        Refunds are processed within 5-10 business days.
                      </p>
                    </div>

                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      If you have any questions about your cancellation or refund, please don't hesitate to contact our support team.
                    </p>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Job Cancelled
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Customer has cancelled this booking</p>
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
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">📋 Cancelled Job Details</p>
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
                          <td style="padding: 8px 0; color: #475569; font-size: 14px;"><strong>Original Date:</strong></td>
                          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${data.pickupDatetime}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- Info Notice -->
                    <div style="background-color: #f0fdfa; border: 1px solid #0D9488; border-radius: 8px; padding: 15px; margin: 0 0 25px 0;">
                      <p style="color: #0D9488; font-size: 14px; margin: 0; line-height: 1.5;">
                        <strong>✓ No action required</strong><br>
                        You don't need to do anything for this booking. Thank you for your understanding.
                      </p>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

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
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Total Travel Solution Group</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Arial', 'Helvetica', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                <!-- Header with Brand Color (Teal) -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                      Total Travel Solution Group
                    </h1>
                    <p style="color: #E0F2F1; margin: 10px 0 0 0; font-size: 16px;">Your Trusted Transfer Partner</p>
                  </td>
                </tr>

                <!-- Welcome Message -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center;">
                    <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">
                      Welcome Aboard, ${data.firstName}! 🎉
                    </h2>
                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Thank you for joining <strong>Total Travel Solution Group</strong>. We're excited to be your partner for all your transfer needs!
                    </p>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0;">
                      Your account has been successfully created with email: <strong>${data.email}</strong>
                    </p>
                  </td>
                </tr>

                <!-- Features Section -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px;">
                      <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; text-align: center;">
                        Why Choose Us?
                      </h3>

                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="display: flex; align-items: start;">
                              <span style="color: #0D9488; font-size: 20px; margin-right: 10px;">✓</span>
                              <div>
                                <strong style="color: #1e293b; font-size: 15px;">Reliable & Professional Service</strong>
                                <p style="color: #475569; font-size: 14px; margin: 5px 0 0 0; line-height: 1.4;">
                                  Licensed drivers and premium vehicles for your comfort and safety.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="display: flex; align-items: start;">
                              <span style="color: #0D9488; font-size: 20px; margin-right: 10px;">✓</span>
                              <div>
                                <strong style="color: #1e293b; font-size: 15px;">Best Value Pricing</strong>
                                <p style="color: #475569; font-size: 14px; margin: 5px 0 0 0; line-height: 1.4;">
                                  Transparent pricing with no hidden fees. Get the best rates for your journey.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="display: flex; align-items: start;">
                              <span style="color: #0D9488; font-size: 20px; margin-right: 10px;">✓</span>
                              <div>
                                <strong style="color: #1e293b; font-size: 15px;">Real-Time Updates</strong>
                                <p style="color: #475569; font-size: 14px; margin: 5px 0 0 0; line-height: 1.4;">
                                  Track your booking and receive instant notifications via email & SMS.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="display: flex; align-items: start;">
                              <span style="color: #E11D48; font-size: 20px; margin-right: 10px;">✓</span>
                              <div>
                                <strong style="color: #1e293b; font-size: 15px;">Flexible Cancellation Policy</strong>
                                <p style="color: #475569; font-size: 14px; margin: 5px 0 0 0; line-height: 1.4;">
                                  Cancel up to <strong style="color: #E11D48;">48 hours</strong> before pickup for a full refund. Plans change, we understand.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="display: flex; align-items: start;">
                              <span style="color: #0D9488; font-size: 20px; margin-right: 10px;">✓</span>
                              <div>
                                <strong style="color: #1e293b; font-size: 15px;">Wide Range of Vehicles</strong>
                                <p style="color: #475569; font-size: 14px; margin: 5px 0 0 0; line-height: 1.4;">
                                  From saloon cars to 8-seater minibuses. Choose the perfect vehicle for your needs.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 10px 0;">
                            <div style="display: flex; align-items: start;">
                              <span style="color: #0D9488; font-size: 20px; margin-right: 10px;">✓</span>
                              <div>
                                <strong style="color: #1e293b; font-size: 15px;">24/7 Customer Support</strong>
                                <p style="color: #475569; font-size: 14px; margin: 5px 0 0 0; line-height: 1.4;">
                                  Our support team is always available to assist you with any questions.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 30px 40px 30px; text-align: center;">
                    <a href="${frontendUrl}/bookings/new" style="display: inline-block; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(13, 148, 136, 0.3);">
                      Book Your First Transfer
                    </a>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276<br>
                      You're receiving this email because you created an account with us.
                    </p>
                  </td>
                </tr>

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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Password Reset Request
                    </h1>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.firstName} ${data.lastName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      We received a request to reset your password. Use the OTP code below to complete the password reset process:
                    </p>

                    <!-- OTP Code Box -->
                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #0D9488; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Your OTP Code
                      </p>
                      <p style="color: #0D9488; font-size: 42px; font-weight: 700; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${data.otp}
                      </p>
                      <p style="color: #64748b; font-size: 13px; margin: 15px 0 0 0;">
                        This code expires in 15 minutes
                      </p>
                    </div>

                    <!-- Important Notice -->
                    <div style="background-color: #fef2f2; border-left: 4px solid #E11D48; padding: 20px; margin: 0 0 30px 0; border-radius: 4px;">
                      <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.6;">
                        <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email or contact our support team if you have concerns about your account security.
                      </p>
                    </div>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

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
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                <!-- Header with Teal Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">
                      Verify Your Email Address
                    </h1>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${data.firstName} ${data.lastName},
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Thank you for creating an account with Total Travel Solution Group. To complete your registration and access all features, please verify your email address using the OTP code below:
                    </p>

                    <!-- OTP Code Box -->
                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #0D9488; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                      <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Your OTP Code
                      </p>
                      <p style="color: #0D9488; font-size: 42px; font-weight: 700; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${data.otp}
                      </p>
                      <p style="color: #64748b; font-size: 13px; margin: 15px 0 0 0;">
                        This code expires in 15 minutes
                      </p>
                    </div>

                    <!-- Benefits Box -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin: 0 0 30px 0;">
                      <p style="color: #475569; font-size: 15px; font-weight: 600; margin: 0 0 15px 0;">
                        ✓ Once verified, you'll be able to:
                      </p>
                      <ul style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Book transfers with ease</li>
                        <li>Track your bookings in real-time</li>
                        <li>Access exclusive customer benefits</li>
                        <li>Receive booking confirmations and updates</li>
                      </ul>
                    </div>

                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; padding: 15px; background-color: #fef9c3; border-radius: 6px;">
                      <strong>Note:</strong> If you didn't create an account with us, please ignore this email or contact our support team.
                    </p>

                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
                      Best regards,<br>
                      <strong>Total Travel Solution Group Team</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #475569; font-size: 14px; margin: 0 0 10px 0;">
                      Need help? Contact us at:
                    </p>
                    <p style="margin: 5px 0;">
                      <a href="mailto:support@totaltravelsolutiongroup.com" style="color: #0D9488; text-decoration: none; font-size: 14px;">
                        support@totaltravelsolutiongroup.com
                      </a>
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 20px 0 0 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Total Travel Solution Group. All rights reserved.<br>
                      Registered in England & Wales | Company Number: 16910276
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
