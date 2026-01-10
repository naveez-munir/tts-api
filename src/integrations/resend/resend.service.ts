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

  private getJobOfferHtml(data: JobOfferData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f0ad4e;">⏰ Action Required: Confirm Job</h1>
        <p>Hello ${data.operatorName},</p>
        <p>Your bid was the lowest! Please confirm acceptance of this job by quoting the booking reference:</p>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107;">
          <p><strong>Booking Reference:</strong> <span style="font-size: 1.2em; font-weight: bold;">${data.bookingReference}</span></p>
          <p><strong>Pickup:</strong> ${data.pickupAddress}</p>
          <p><strong>Dropoff:</strong> ${data.dropoffAddress}</p>
          <p><strong>Date & Time:</strong> ${data.pickupDatetime}</p>
          <p><strong>Your Bid:</strong> ${data.bidAmount}</p>
        </div>
        <div style="background: #dc3545; color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>⚠️ Deadline to Accept:</strong> ${data.acceptanceDeadline}</p>
          <p style="margin: 5px 0 0 0; font-size: 0.9em;">If you do not confirm by this time, the job will be offered to another operator.</p>
        </div>
        <p>Log in now to confirm acceptance by quoting the booking reference number.</p>
      </div>
    `;
  }

  private getBookingCancellationHtml(data: BookingCancellationData): string {
    const refundMessage = data.refundPercent > 0
      ? `<p style="color: #28a745;"><strong>Refund Amount:</strong> ${data.refundAmount} (${data.refundPercent}% of booking value)</p>`
      : `<p style="color: #dc3545;"><strong>Refund:</strong> No refund applicable based on cancellation policy</p>`;

    const reasonMessage = data.cancellationReason
      ? `<p><strong>Reason:</strong> ${data.cancellationReason}</p>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc3545;">Booking Cancelled</h1>
        <p>Dear ${data.customerName},</p>
        <p>Your booking has been cancelled. Here are the details:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Booking Reference:</strong> ${data.bookingReference}</p>
          <p><strong>Pickup:</strong> ${data.pickupAddress}</p>
          <p><strong>Dropoff:</strong> ${data.dropoffAddress}</p>
          <p><strong>Original Date & Time:</strong> ${data.pickupDatetime}</p>
          ${reasonMessage}
        </div>
        <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Refund Information</h3>
          ${refundMessage}
          <p style="font-size: 0.9em; color: #666;">Refunds are processed within 5-10 business days.</p>
        </div>
        <p>If you have any questions, please contact our support team.</p>
      </div>
    `;
  }

  private getOperatorJobCancellationHtml(data: OperatorJobCancellationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc3545;">Job Cancelled</h1>
        <p>Hello ${data.operatorName},</p>
        <p>Unfortunately, the following job has been cancelled by the customer:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Booking Reference:</strong> ${data.bookingReference}</p>
          <p><strong>Pickup:</strong> ${data.pickupAddress}</p>
          <p><strong>Dropoff:</strong> ${data.dropoffAddress}</p>
          <p><strong>Original Date & Time:</strong> ${data.pickupDatetime}</p>
        </div>
        <p>No further action is required from you for this booking.</p>
        <p>Thank you for your understanding.</p>
      </div>
    `;
  }
}
