import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

export interface SmsParams {
  to: string;
  message: string;
}

export interface BookingSmsData {
  bookingReference: string;
  pickupDatetime: string;
  pickupAddress: string;
}

export interface DriverSmsData {
  bookingReference: string;
  driverName: string;
  driverPhone: string;
  pickupDatetime: string;
}

export interface JobAlertSmsData {
  pickupPostcode: string;
  dropoffPostcode: string;
  pickupDatetime: string;
  maxBid: string;
}

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: Twilio | null;
  private readonly isConfigured: boolean;
  private readonly fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

    if (
      accountSid &&
      authToken &&
      !accountSid.includes('your_') &&
      !authToken.includes('your_')
    ) {
      this.client = new Twilio(accountSid, authToken);
      this.isConfigured = true;
      this.logger.log('Twilio configured successfully');
    } else {
      this.client = null;
      this.isConfigured = false;
      this.logger.warn('Twilio not configured - SMS will be logged only');
    }
  }

  /**
   * Send a generic SMS
   */
  async sendSms(params: SmsParams): Promise<boolean> {
    // Format phone number (ensure UK format)
    const formattedPhone = this.formatUkPhoneNumber(params.to);

    if (!this.isConfigured || !this.client) {
      this.logger.log(`[MOCK SMS] To: ${formattedPhone}, Message: ${params.message}`);
      return true;
    }

    try {
      await this.client.messages.create({
        to: formattedPhone,
        from: this.fromNumber,
        body: params.message,
      });
      this.logger.log(`SMS sent to ${formattedPhone}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${formattedPhone}`, error);
      return false;
    }
  }

  /**
   * Send booking confirmation SMS to customer
   */
  async sendBookingConfirmationSms(
    phone: string,
    data: BookingSmsData,
  ): Promise<boolean> {
    const message = `Booking Confirmed! Ref: ${data.bookingReference}. Pickup: ${data.pickupDatetime} from ${data.pickupAddress}. We'll send driver details when assigned.`;

    return this.sendSms({ to: phone, message });
  }

  /**
   * Send driver details SMS to customer (24h before pickup)
   */
  async sendDriverDetailsSms(
    phone: string,
    data: DriverSmsData,
  ): Promise<boolean> {
    const message = `Your driver for ${data.bookingReference}: ${data.driverName}, Tel: ${data.driverPhone}. Pickup: ${data.pickupDatetime}. Have a safe journey!`;

    return this.sendSms({ to: phone, message });
  }

  /**
   * Send urgent job alert to operator
   */
  async sendJobAlertSms(
    phone: string,
    data: JobAlertSmsData,
  ): Promise<boolean> {
    const message = `URGENT JOB: ${data.pickupPostcode} to ${data.dropoffPostcode}, ${data.pickupDatetime}. Max bid: ${data.maxBid}. Log in to bid now!`;

    return this.sendSms({ to: phone, message });
  }

  /**
   * Send bid won notification to operator
   */
  async sendBidWonSms(
    phone: string,
    bookingReference: string,
  ): Promise<boolean> {
    const message = `Congratulations! You won booking ${bookingReference}. Log in to submit driver details.`;

    return this.sendSms({ to: phone, message });
  }

  /**
   * Send job offer SMS to operator (requires acceptance)
   */
  async sendJobOfferSms(
    phone: string,
    bookingReference: string,
    deadline: string,
  ): Promise<boolean> {
    const message = `ACTION REQUIRED: You have the lowest bid for ${bookingReference}. Please confirm acceptance by ${deadline} or the job will be offered to another operator.`;

    return this.sendSms({ to: phone, message });
  }

  /**
   * Send booking cancellation SMS to customer
   */
  async sendBookingCancellationSms(
    phone: string,
    data: { bookingReference: string; refundAmount: string; refundPercent: number },
  ): Promise<boolean> {
    const refundMessage = data.refundPercent > 0
      ? `Refund of ${data.refundAmount} (${data.refundPercent}%) will be processed within 5-10 days.`
      : 'No refund applicable based on cancellation policy.';

    const message = `Your booking ${data.bookingReference} has been cancelled. ${refundMessage}`;

    return this.sendSms({ to: phone, message });
  }

  /**
   * Send job cancellation SMS to operator
   */
  async sendJobCancellationSms(
    phone: string,
    bookingReference: string,
  ): Promise<boolean> {
    const message = `Job ${bookingReference} has been cancelled by the customer. No action required.`;

    return this.sendSms({ to: phone, message });
  }

  /**
   * Send job modification SMS to operator
   */
  async sendJobModificationSms(
    phone: string,
    bookingReference: string,
    changes: string,
  ): Promise<boolean> {
    const message = `Job ${bookingReference} has been updated by the customer. Changes: ${changes}. Please review the updated details in your app.`;

    return this.sendSms({ to: phone, message });
  }

  /**
   * Format phone number to UK international format
   */
  private formatUkPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with +44
    if (cleaned.startsWith('0')) {
      cleaned = '44' + cleaned.substring(1);
    }

    // Add + prefix if not present
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }
}

