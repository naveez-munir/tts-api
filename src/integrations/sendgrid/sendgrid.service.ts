import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

export interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
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

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);
  private readonly isConfigured: boolean;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    this.fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@airporttransfer.com';

    if (apiKey && !apiKey.includes('your_')) {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      this.logger.log('SendGrid configured successfully');
    } else {
      this.isConfigured = false;
      this.logger.warn('SendGrid not configured - emails will be logged only');
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(params: EmailParams): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.log(`[MOCK EMAIL] To: ${params.to}, Subject: ${params.subject}`);
      return true;
    }

    try {
      await sgMail.send({
        to: params.to,
        from: this.fromEmail,
        subject: params.subject,
        text: params.text || '',
        html: params.html || '',
        ...(params.templateId && { templateId: params.templateId }),
        ...(params.dynamicTemplateData && { dynamicTemplateData: params.dynamicTemplateData }),
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

  // HTML Email Templates
  private getBookingConfirmationHtml(data: BookingConfirmationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Booking Confirmed</h1>
        <p>Dear ${data.customerName},</p>
        <p>Thank you for your booking. Here are your journey details:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Booking Reference:</strong> ${data.bookingReference}</p>
          <p><strong>Pickup:</strong> ${data.pickupAddress}</p>
          <p><strong>Dropoff:</strong> ${data.dropoffAddress}</p>
          <p><strong>Date & Time:</strong> ${data.pickupDatetime}</p>
          <p><strong>Vehicle:</strong> ${data.vehicleType}</p>
          <p><strong>Passengers:</strong> ${data.passengerCount}</p>
          <p><strong>Total Price:</strong> ${data.totalPrice}</p>
        </div>
        <p>We will send you driver details once assigned.</p>
        <p>Thank you for choosing our service!</p>
      </div>
    `;
  }

  private getDriverAssignedHtml(data: DriverAssignedData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Driver Assigned</h1>
        <p>Dear ${data.customerName},</p>
        <p>Great news! A driver has been assigned to your booking.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Booking Reference:</strong> ${data.bookingReference}</p>
          <p><strong>Driver Name:</strong> ${data.driverName}</p>
          <p><strong>Driver Phone:</strong> ${data.driverPhone}</p>
          <p><strong>Vehicle Registration:</strong> ${data.vehicleRegistration}</p>
          <p><strong>Pickup Time:</strong> ${data.pickupDatetime}</p>
          <p><strong>Pickup Address:</strong> ${data.pickupAddress}</p>
        </div>
        <p>Your driver will contact you if needed. Have a safe journey!</p>
      </div>
    `;
  }

  private getNewJobAlertHtml(data: NewJobAlertData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">New Job Available</h1>
        <p>Hello ${data.operatorName},</p>
        <p>A new job is available in your service area:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Pickup:</strong> ${data.pickupAddress}</p>
          <p><strong>Dropoff:</strong> ${data.dropoffAddress}</p>
          <p><strong>Date & Time:</strong> ${data.pickupDatetime}</p>
          <p><strong>Vehicle Required:</strong> ${data.vehicleType}</p>
          <p><strong>Maximum Bid:</strong> ${data.maxBidAmount}</p>
        </div>
        <p>Log in to submit your bid now!</p>
      </div>
    `;
  }

  private getBidWonHtml(data: BidWonData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">🎉 Congratulations!</h1>
        <p>Hello ${data.operatorName},</p>
        <p>Your bid was successful! You have been assigned this job:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Booking Reference:</strong> ${data.bookingReference}</p>
          <p><strong>Pickup:</strong> ${data.pickupAddress}</p>
          <p><strong>Dropoff:</strong> ${data.dropoffAddress}</p>
          <p><strong>Date & Time:</strong> ${data.pickupDatetime}</p>
          <p><strong>Your Bid:</strong> ${data.bidAmount}</p>
        </div>
        <p>Please log in to submit driver details for this booking.</p>
      </div>
    `;
  }
}

