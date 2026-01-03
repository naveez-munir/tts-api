import { Injectable, Logger } from '@nestjs/common';
import { SendGridService } from '../sendgrid/sendgrid.service.js';
import { TwilioService } from '../twilio/twilio.service.js';
import { PrismaService } from '../../database/prisma.service.js';

export interface CustomerNotificationData {
  customerId: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: Date;
  vehicleType: string;
  passengerCount: number;
  totalPrice: string;
}

// Return journey notification data
export interface ReturnJourneyNotificationData {
  customerId: string;
  groupReference: string;
  outbound: {
    bookingReference: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupDatetime: Date;
    vehicleType: string;
    passengerCount: number;
    price: string;
  };
  returnJourney: {
    bookingReference: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupDatetime: Date;
    vehicleType: string;
    passengerCount: number;
    price: string;
  };
  totalPrice: string;
  discountAmount: string;
}

export interface DriverAssignmentData {
  customerId: string;
  bookingReference: string;
  driverName: string;
  driverPhone: string;
  vehicleRegistration: string;
  pickupDatetime: Date;
  pickupAddress: string;
  journeyType?: 'ONE_WAY' | 'OUTBOUND' | 'RETURN';
  groupReference?: string;
}

export interface JobBroadcastData {
  jobId: string;
  pickupAddress: string;
  pickupPostcode: string;
  dropoffAddress: string;
  dropoffPostcode: string;
  pickupDatetime: Date;
  vehicleType: string;
  maxBidAmount: string;
  operatorIds: string[];
  journeyType?: 'ONE_WAY' | 'OUTBOUND' | 'RETURN';
  groupReference?: string;
}

export interface BidWonData {
  operatorId: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: Date;
  bidAmount: string;
  journeyType?: 'ONE_WAY' | 'OUTBOUND' | 'RETURN';
  groupReference?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly sendGridService: SendGridService,
    private readonly twilioService: TwilioService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Send booking confirmation to customer (email + SMS)
   */
  async sendBookingConfirmation(data: CustomerNotificationData): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${data.customerId}`);
      return;
    }

    const formattedDatetime = this.formatDateTime(data.pickupDatetime);

    // Send email
    await this.sendGridService.sendBookingConfirmation(customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingReference: data.bookingReference,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
      pickupDatetime: formattedDatetime,
      vehicleType: data.vehicleType,
      passengerCount: data.passengerCount,
      totalPrice: data.totalPrice,
    });

    // Send SMS if phone available
    if (customer.phoneNumber) {
      await this.twilioService.sendBookingConfirmationSms(customer.phoneNumber, {
        bookingReference: data.bookingReference,
        pickupDatetime: formattedDatetime,
        pickupAddress: data.pickupAddress,
      });
    }

    // Log notification in database
    await this.logNotification(customer.id, 'BOOKING_CONFIRMATION', data.bookingReference);
  }

  /**
   * Send return journey booking confirmation to customer (email + SMS)
   * Includes both outbound and return details in a single notification
   */
  async sendReturnJourneyConfirmation(data: ReturnJourneyNotificationData): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${data.customerId}`);
      return;
    }

    const outboundDatetime = this.formatDateTime(data.outbound.pickupDatetime);
    const returnDatetime = this.formatDateTime(data.returnJourney.pickupDatetime);

    // Send email with both journey details
    await this.sendGridService.sendEmail({
      to: customer.email,
      subject: `Return Journey Confirmed - ${data.groupReference}`,
      html: `
        <h2>Return Journey Booking Confirmed</h2>
        <p>Dear ${customer.firstName} ${customer.lastName},</p>
        <p>Your return journey has been confirmed. Here are your booking details:</p>

        <h3>Outbound Journey (${data.outbound.bookingReference})</h3>
        <ul>
          <li><strong>From:</strong> ${data.outbound.pickupAddress}</li>
          <li><strong>To:</strong> ${data.outbound.dropoffAddress}</li>
          <li><strong>Date/Time:</strong> ${outboundDatetime}</li>
          <li><strong>Vehicle:</strong> ${data.outbound.vehicleType}</li>
          <li><strong>Passengers:</strong> ${data.outbound.passengerCount}</li>
          <li><strong>Price:</strong> £${data.outbound.price}</li>
        </ul>

        <h3>Return Journey (${data.returnJourney.bookingReference})</h3>
        <ul>
          <li><strong>From:</strong> ${data.returnJourney.pickupAddress}</li>
          <li><strong>To:</strong> ${data.returnJourney.dropoffAddress}</li>
          <li><strong>Date/Time:</strong> ${returnDatetime}</li>
          <li><strong>Vehicle:</strong> ${data.returnJourney.vehicleType}</li>
          <li><strong>Passengers:</strong> ${data.returnJourney.passengerCount}</li>
          <li><strong>Price:</strong> £${data.returnJourney.price}</li>
        </ul>

        <h3>Payment Summary</h3>
        <ul>
          <li><strong>Return Journey Discount:</strong> -£${data.discountAmount}</li>
          <li><strong>Total Paid:</strong> £${data.totalPrice}</li>
        </ul>

        <p>Your group reference is: <strong>${data.groupReference}</strong></p>
        <p>Thank you for booking with us!</p>
      `,
    });

    // Send SMS if phone available
    if (customer.phoneNumber) {
      await this.twilioService.sendSms({
        to: customer.phoneNumber,
        message: `Return journey confirmed! Ref: ${data.groupReference}. Outbound: ${outboundDatetime}. Return: ${returnDatetime}. Total: £${data.totalPrice}`,
      });
    }

    // Log notification
    await this.logNotification(customer.id, 'RETURN_JOURNEY_CONFIRMATION', data.groupReference);
  }

  /**
   * Send driver assignment notification to customer
   */
  async sendDriverAssignment(data: DriverAssignmentData): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) return;

    const formattedDatetime = this.formatDateTime(data.pickupDatetime);

    await this.sendGridService.sendDriverAssigned(customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingReference: data.bookingReference,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      vehicleRegistration: data.vehicleRegistration,
      pickupDatetime: formattedDatetime,
      pickupAddress: data.pickupAddress,
    });

    if (customer.phoneNumber) {
      await this.twilioService.sendDriverDetailsSms(customer.phoneNumber, {
        bookingReference: data.bookingReference,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        pickupDatetime: formattedDatetime,
      });
    }

    await this.logNotification(customer.id, 'DRIVER_ASSIGNED', data.bookingReference);
  }

  /**
   * Broadcast new job to all operators in service area
   */
  async broadcastNewJob(data: JobBroadcastData): Promise<void> {
    const formattedDatetime = this.formatDateTime(data.pickupDatetime);

    for (const operatorId of data.operatorIds) {
      const operator = await this.prisma.operatorProfile.findUnique({
        where: { id: operatorId },
        include: { user: true },
      });

      if (!operator) continue;

      // Send email
      await this.sendGridService.sendNewJobAlert(operator.user.email, {
        operatorName: operator.companyName,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        pickupDatetime: formattedDatetime,
        vehicleType: data.vehicleType,
        maxBidAmount: data.maxBidAmount,
        jobId: data.jobId,
      });

      // Send SMS for urgent jobs (within 24h)
      const hoursUntilPickup = (data.pickupDatetime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilPickup < 24 && operator.user.phoneNumber) {
        await this.twilioService.sendJobAlertSms(operator.user.phoneNumber, {
          pickupPostcode: data.pickupPostcode,
          dropoffPostcode: data.dropoffPostcode,
          pickupDatetime: formattedDatetime,
          maxBid: data.maxBidAmount,
        });
      }

      await this.logNotification(operator.userId, 'NEW_JOB_ALERT', data.jobId);
    }
  }

  /**
   * Notify operator they won the bid
   */
  async sendBidWonNotification(data: BidWonData): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: data.operatorId },
      include: { user: true },
    });

    if (!operator) return;

    const formattedDatetime = this.formatDateTime(data.pickupDatetime);

    await this.sendGridService.sendBidWonNotification(operator.user.email, {
      operatorName: operator.companyName,
      bookingReference: data.bookingReference,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
      pickupDatetime: formattedDatetime,
      bidAmount: data.bidAmount,
    });

    if (operator.user.phoneNumber) {
      await this.twilioService.sendBidWonSms(operator.user.phoneNumber, data.bookingReference);
    }

    await this.logNotification(operator.userId, 'BID_WON', data.bookingReference);
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async logNotification(
    userId: string,
    type: string,
    reference: string,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'EMAIL',
          subject: type,
          message: `Notification sent for: ${reference}`,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to log notification', error);
    }
  }
}

