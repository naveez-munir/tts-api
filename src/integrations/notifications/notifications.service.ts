import { Injectable, Logger } from '@nestjs/common';
import { ResendService } from '../resend/resend.service.js';
import { TwilioService } from '../twilio/twilio.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { SystemSettingsService } from '../../modules/system-settings/system-settings.service.js';

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

export interface JobBroadcastStop {
  address: string;
  postcode: string | null;
}

export interface JobBroadcastData {
  jobId: string;
  bookingReference: string;
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
  stops?: JobBroadcastStop[];
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

export interface JobOfferData {
  operatorId: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: Date;
  bidAmount: string;
  acceptanceDeadline: Date;
}

export interface JobEscalationData {
  jobId: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: Date;
  vehicleType: string;
  customerPrice: string;
  reason: 'NO_BIDS_RECEIVED' | 'ALL_OPERATORS_REJECTED';
}

export interface BookingCancellationNotificationData {
  customerId: string;
  bookingReference: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: Date;
  refundAmount: string;
  refundPercent: number;
  cancellationReason?: string;
  assignedOperatorId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly resendService: ResendService,
    private readonly twilioService: TwilioService,
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
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
    await this.resendService.sendBookingConfirmation(customer.email, {
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
    await this.resendService.sendEmail({
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

    await this.resendService.sendDriverAssigned(customer.email, {
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

    // Get urgent job threshold from SystemSettings
    const urgentThresholdHours = await this.systemSettingsService.getSettingOrDefault(
      'URGENT_JOB_SMS_THRESHOLD_HOURS',
      24,
    );

    for (const operatorId of data.operatorIds) {
      const operator = await this.prisma.operatorProfile.findUnique({
        where: { id: operatorId },
        include: { user: true },
      });

      if (!operator) continue;

      // Send email
      await this.resendService.sendNewJobAlert(operator.user.email, {
        operatorName: operator.companyName,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        pickupDatetime: formattedDatetime,
        vehicleType: data.vehicleType,
        maxBidAmount: data.maxBidAmount,
        jobId: data.jobId,
      });

      // Send SMS for urgent jobs (within threshold hours)
      const hoursUntilPickup = (data.pickupDatetime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilPickup < urgentThresholdHours && operator.user.phoneNumber) {
        await this.twilioService.sendJobAlertSms(operator.user.phoneNumber, {
          pickupPostcode: data.pickupPostcode,
          dropoffPostcode: data.dropoffPostcode,
          pickupDatetime: formattedDatetime,
          maxBid: data.maxBidAmount,
        });
      }

      await this.logNotification(operator.userId, 'NEW_JOB_ALERT', data.jobId);
    }

    // Notify admin about the new job
    const adminEmail = await this.systemSettingsService.getSettingOrDefault(
      'ADMIN_PAYOUT_EMAIL',
      'admin@example.com',
    );

    await this.resendService.sendNewJobToAdmin(adminEmail, {
      jobId: data.jobId,
      bookingReference: data.bookingReference,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
      pickupDatetime: formattedDatetime,
      vehicleType: data.vehicleType,
      maxBidAmount: data.maxBidAmount,
      operatorCount: data.operatorIds.length,
    });

    this.logger.log(`Admin notified about new job: ${data.jobId}`);
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

    await this.resendService.sendBidWonNotification(operator.user.email, {
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

  /**
   * Notify operator that a job is offered to them and requires acceptance
   */
  async sendJobOfferNotification(data: JobOfferData): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: data.operatorId },
      include: { user: true },
    });

    if (!operator) return;

    const formattedDatetime = this.formatDateTime(data.pickupDatetime);
    const formattedDeadline = this.formatDateTime(data.acceptanceDeadline);

    await this.resendService.sendJobOfferNotification(operator.user.email, {
      operatorName: operator.companyName,
      bookingReference: data.bookingReference,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
      pickupDatetime: formattedDatetime,
      bidAmount: data.bidAmount,
      acceptanceDeadline: formattedDeadline,
    });

    if (operator.user.phoneNumber) {
      await this.twilioService.sendJobOfferSms(
        operator.user.phoneNumber,
        data.bookingReference,
        formattedDeadline,
      );
    }

    await this.logNotification(operator.userId, 'JOB_OFFER', data.bookingReference);
  }

  /**
   * Send escalation notification to admin when job cannot be assigned
   */
  async sendJobEscalationToAdmin(data: JobEscalationData): Promise<void> {
    // Get admin email from system settings (reuse ADMIN_PAYOUT_EMAIL)
    const adminEmail = await this.systemSettingsService.getSettingOrDefault(
      'ADMIN_PAYOUT_EMAIL',
      'admin@example.com',
    );

    const formattedDatetime = this.formatDateTime(data.pickupDatetime);
    const reasonText = data.reason === 'NO_BIDS_RECEIVED'
      ? 'No operators submitted bids for this job'
      : 'All operators rejected or did not respond to this job';

    // Send email to admin
    await this.resendService.sendEmail({
      to: adminEmail,
      subject: `⚠️ ESCALATION: Job ${data.bookingReference} Requires Attention`,
      html: `
        <h2>Job Escalation Alert</h2>
        <p><strong>Reason:</strong> ${reasonText}</p>

        <h3>Job Details</h3>
        <ul>
          <li><strong>Booking Reference:</strong> ${data.bookingReference}</li>
          <li><strong>Job ID:</strong> ${data.jobId}</li>
          <li><strong>Pickup:</strong> ${data.pickupAddress}</li>
          <li><strong>Dropoff:</strong> ${data.dropoffAddress}</li>
          <li><strong>Date/Time:</strong> ${formattedDatetime}</li>
          <li><strong>Vehicle Type:</strong> ${data.vehicleType}</li>
          <li><strong>Customer Price:</strong> £${data.customerPrice}</li>
        </ul>

        <h3>Action Required</h3>
        <p>Please log in to the admin panel to manually assign an operator or contact the customer.</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/jobs/${data.jobId}">View Job in Admin Panel</a></p>
      `,
    });

    // Optionally send SMS to admin phone if configured
    const adminPhone = await this.systemSettingsService.getSetting('ADMIN_ESCALATION_PHONE');
    if (adminPhone) {
      await this.twilioService.sendSms({
        to: adminPhone,
        message: `ESCALATION: Job ${data.bookingReference} needs attention. ${reasonText}. Check admin panel.`,
      });
    }

    this.logger.warn(`Escalation notification sent to admin for job ${data.jobId}: ${data.reason}`);
  }

  /**
   * Send booking cancellation notification to customer and operator (if assigned)
   */
  async sendBookingCancellation(data: BookingCancellationNotificationData): Promise<void> {
    // Get customer details
    const customer = await this.prisma.user.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${data.customerId}`);
      return;
    }

    const formattedDatetime = this.formatDateTime(data.pickupDatetime);

    // Send email to customer
    await this.resendService.sendBookingCancellation(customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingReference: data.bookingReference,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
      pickupDatetime: formattedDatetime,
      refundAmount: data.refundAmount,
      refundPercent: data.refundPercent,
      cancellationReason: data.cancellationReason,
    });

    // Send SMS to customer if phone available
    if (customer.phoneNumber) {
      await this.twilioService.sendBookingCancellationSms(customer.phoneNumber, {
        bookingReference: data.bookingReference,
        refundAmount: data.refundAmount,
        refundPercent: data.refundPercent,
      });
    }

    await this.logNotification(customer.id, 'BOOKING_CANCELLATION', data.bookingReference);

    // Notify assigned operator if exists
    if (data.assignedOperatorId) {
      const operator = await this.prisma.operatorProfile.findUnique({
        where: { id: data.assignedOperatorId },
        include: { user: true },
      });

      if (operator) {
        await this.resendService.sendOperatorJobCancellation(operator.user.email, {
          operatorName: operator.companyName,
          bookingReference: data.bookingReference,
          pickupAddress: data.pickupAddress,
          dropoffAddress: data.dropoffAddress,
          pickupDatetime: formattedDatetime,
        });

        if (operator.user.phoneNumber) {
          await this.twilioService.sendJobCancellationSms(
            operator.user.phoneNumber,
            data.bookingReference,
          );
        }

        await this.logNotification(operator.userId, 'JOB_CANCELLATION', data.bookingReference);
      }
    }

    this.logger.log(`Cancellation notifications sent for booking ${data.bookingReference}`);
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

  // =========================================================================
  // OPERATOR LIFECYCLE NOTIFICATIONS
  // =========================================================================

  /**
   * Send operator approval notification
   */
  async sendOperatorApproval(operatorId: string): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    await this.resendService.sendOperatorApproval(operator.user.email, {
      companyName: operator.companyName,
      contactName: `${operator.user.firstName} ${operator.user.lastName}`,
    });

    await this.logNotification(operator.userId, 'OPERATOR_APPROVED', operatorId);
    this.logger.log(`Approval notification sent to operator ${operatorId}`);
  }

  /**
   * Send operator rejection notification
   */
  async sendOperatorRejection(operatorId: string, reason?: string): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    await this.resendService.sendOperatorRejection(operator.user.email, {
      companyName: operator.companyName,
      contactName: `${operator.user.firstName} ${operator.user.lastName}`,
      reason,
    });

    await this.logNotification(operator.userId, 'OPERATOR_REJECTED', operatorId);
    this.logger.log(`Rejection notification sent to operator ${operatorId}`);
  }

  /**
   * Send operator suspension notification
   */
  async sendOperatorSuspension(operatorId: string, reason?: string): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    await this.resendService.sendOperatorSuspension(operator.user.email, {
      companyName: operator.companyName,
      contactName: `${operator.user.firstName} ${operator.user.lastName}`,
      reason,
    });

    await this.logNotification(operator.userId, 'OPERATOR_SUSPENDED', operatorId);
    this.logger.log(`Suspension notification sent to operator ${operatorId}`);
  }

  /**
   * Send operator reinstatement notification
   */
  async sendOperatorReinstatement(operatorId: string): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    await this.resendService.sendOperatorReinstatement(operator.user.email, {
      companyName: operator.companyName,
      contactName: `${operator.user.firstName} ${operator.user.lastName}`,
    });

    await this.logNotification(operator.userId, 'OPERATOR_REINSTATED', operatorId);
    this.logger.log(`Reinstatement notification sent to operator ${operatorId}`);
  }

  /**
   * Send welcome email to newly registered operator
   */
  async sendOperatorWelcome(operatorId: string): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    await this.resendService.sendOperatorWelcome(operator.user.email, {
      companyName: operator.companyName,
      contactName: `${operator.user.firstName} ${operator.user.lastName}`,
      email: operator.user.email,
    });

    await this.logNotification(operator.userId, 'OPERATOR_WELCOME', operatorId);
    this.logger.log(`Welcome email sent to operator ${operatorId}`);
  }

  // =========================================================================
  // ADMIN NOTIFICATIONS
  // =========================================================================

  /**
   * Send notification to admin about new operator registration
   */
  async sendNewOperatorRegistrationToAdmin(operatorId: string): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    // Get admin email from system settings
    const adminEmail = await this.systemSettingsService.getSettingOrDefault(
      'ADMIN_PAYOUT_EMAIL',
      'admin@example.com',
    );

    await this.resendService.sendNewOperatorRegistrationToAdmin(adminEmail, {
      companyName: operator.companyName,
      contactName: `${operator.user.firstName} ${operator.user.lastName}`,
      contactEmail: operator.user.email,
      registrationNumber: operator.registrationNumber || 'Not provided',
      operatorId: operatorId,
    });

    this.logger.log(`Admin notified about new operator registration: ${operatorId}`);
  }

  /**
   * Send manual job assignment notification to operator
   */
  async sendManualJobAssignmentToOperator(
    operatorId: string,
    bookingReference: string,
    pickupAddress: string,
    dropoffAddress: string,
    pickupDatetime: Date,
    bidAmount: string,
  ): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    const formattedDatetime = this.formatDateTime(pickupDatetime);

    await this.resendService.sendManualJobAssignmentToOperator(operator.user.email, {
      operatorName: operator.companyName,
      bookingReference,
      pickupAddress,
      dropoffAddress,
      pickupDatetime: formattedDatetime,
      bidAmount,
    });

    await this.logNotification(operator.userId, 'MANUAL_JOB_ASSIGNMENT', bookingReference);
    this.logger.log(`Manual job assignment notification sent to operator ${operatorId}`);
  }

  /**
   * Send manual job assignment notification to customer
   */
  async sendManualJobAssignmentToCustomer(
    customerId: string,
    bookingReference: string,
    pickupAddress: string,
    dropoffAddress: string,
    pickupDatetime: Date,
  ): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${customerId}`);
      return;
    }

    const formattedDatetime = this.formatDateTime(pickupDatetime);

    await this.resendService.sendManualJobAssignmentToCustomer(customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingReference,
      pickupAddress,
      dropoffAddress,
      pickupDatetime: formattedDatetime,
    });

    await this.logNotification(customer.id, 'DRIVER_BEING_ASSIGNED', bookingReference);
    this.logger.log(`Manual job assignment notification sent to customer ${customerId}`);
  }

  // =========================================================================
  // CUSTOMER NOTIFICATIONS
  // =========================================================================

  /**
   * Send customer account deactivation notification
   */
  async sendCustomerDeactivation(customerId: string, reason?: string): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${customerId}`);
      return;
    }

    await this.resendService.sendCustomerDeactivation(customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      reason,
    });

    await this.logNotification(customer.id, 'CUSTOMER_DEACTIVATED', customerId);
    this.logger.log(`Deactivation notification sent to customer ${customerId}`);
  }

  /**
   * Send job completion notification to customer
   */
  async sendJobCompletion(
    customerId: string,
    bookingReference: string,
    pickupAddress: string,
    dropoffAddress: string,
    pickupDatetime: Date,
  ): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${customerId}`);
      return;
    }

    const formattedDatetime = this.formatDateTime(pickupDatetime);

    await this.resendService.sendJobCompletion(customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingReference,
      pickupAddress,
      dropoffAddress,
      pickupDatetime: formattedDatetime,
    });

    await this.logNotification(customer.id, 'JOB_COMPLETED', bookingReference);
    this.logger.log(`Job completion notification sent to customer ${customerId}`);
  }

  /**
   * Send booking modification notification to customer
   */
  async sendBookingModification(
    customerId: string,
    bookingReference: string,
    pickupAddress: string,
    dropoffAddress: string,
    pickupDatetime: Date,
    changes: string[],
  ): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${customerId}`);
      return;
    }

    const formattedDatetime = this.formatDateTime(pickupDatetime);

    await this.resendService.sendBookingModification(customer.email, {
      customerName: `${customer.firstName} ${customer.lastName}`,
      bookingReference,
      pickupAddress,
      dropoffAddress,
      pickupDatetime: formattedDatetime,
      changes,
    });

    await this.logNotification(customer.id, 'BOOKING_MODIFIED', bookingReference);
    this.logger.log(`Booking modification notification sent to customer ${customerId}`);
  }

  /**
   * Send job modification notification to operator
   */
  async sendOperatorJobModification(data: {
    operatorId: string;
    operatorEmail: string;
    operatorPhone: string | null;
    operatorName: string;
    bookingReference: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupDatetime: Date;
    passengerCount: number;
    luggageCount: number;
    vehicleType: string;
    changes: string[];
  }): Promise<void> {
    const formattedDatetime = this.formatDateTime(data.pickupDatetime);

    // Send email notification
    await this.resendService.sendOperatorJobModification(data.operatorEmail, {
      operatorName: data.operatorName,
      bookingReference: data.bookingReference,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
      pickupDatetime: formattedDatetime,
      passengerCount: data.passengerCount,
      luggageCount: data.luggageCount,
      vehicleType: data.vehicleType,
      changes: data.changes,
    });

    // Send SMS notification if phone available
    if (data.operatorPhone) {
      const changesList = data.changes.join(', ');
      await this.twilioService.sendJobModificationSms(
        data.operatorPhone,
        data.bookingReference,
        changesList,
      );
    }

    await this.logNotification(data.operatorId, 'JOB_MODIFIED', data.bookingReference);
    this.logger.log(`Job modification notification sent to operator ${data.operatorId}`);
  }

  // =========================================================================
  // DOCUMENT EXPIRY NOTIFICATIONS
  // =========================================================================

  /**
   * Send document expiry warning to operator
   */
  async sendDocumentExpiryWarning(
    operatorId: string,
    documentType: string,
    expiryDate: Date,
    daysUntilExpiry: number,
  ): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    const formattedExpiryDate = expiryDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    await this.resendService.sendDocumentExpiryWarning(operator.user.email, {
      operatorName: operator.companyName,
      documentType,
      expiryDate: formattedExpiryDate,
      daysUntilExpiry,
    });

    await this.logNotification(operator.userId, 'DOCUMENT_EXPIRY_WARNING', documentType);
    this.logger.log(`Document expiry warning sent to operator ${operatorId} for ${documentType}`);
  }

  /**
   * Send document expired notification to operator
   */
  async sendDocumentExpired(
    operatorId: string,
    documentType: string,
    expiredDate: Date,
  ): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    const formattedExpiredDate = expiredDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    await this.resendService.sendDocumentExpired(operator.user.email, {
      operatorName: operator.companyName,
      documentType,
      expiredDate: formattedExpiredDate,
    });

    await this.logNotification(operator.userId, 'DOCUMENT_EXPIRED', documentType);
    this.logger.log(`Document expired notification sent to operator ${operatorId} for ${documentType}`);
  }

  /**
   * Send document expiry notification to admin
   */
  async sendDocumentExpiryToAdmin(
    operatorId: string,
    documentType: string,
    expiryDate: Date,
  ): Promise<void> {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator) {
      this.logger.warn(`Operator not found: ${operatorId}`);
      return;
    }

    // Get admin email from system settings
    const adminEmail = await this.systemSettingsService.getSettingOrDefault(
      'ADMIN_PAYOUT_EMAIL',
      'admin@example.com',
    );

    const formattedExpiryDate = expiryDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    await this.resendService.sendDocumentExpiryToAdmin(adminEmail, {
      operatorName: operator.companyName,
      operatorEmail: operator.user.email,
      operatorId,
      documentType,
      expiryDate: formattedExpiryDate,
    });

    this.logger.log(`Admin notified about document expiry for operator ${operatorId}`);
  }

  // =========================================================================
  // JOURNEY REMINDER NOTIFICATIONS
  // =========================================================================

  /**
   * Send journey reminder to customer (24 hours before pickup)
   */
  async sendJourneyReminder(
    bookingId: string,
    driverDetails?: {
      driverName: string;
      driverPhone: string;
      vehicleRegistration: string;
    },
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
      },
    });

    if (!booking || !booking.customer) {
      this.logger.warn(`Cannot send journey reminder: Booking ${bookingId} not found`);
      return;
    }

    const formattedPickupDate = this.formatDateTime(booking.pickupDatetime);

    await this.resendService.sendJourneyReminder(booking.customer.email, {
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      bookingReference: booking.bookingReference,
      pickupDatetime: formattedPickupDate,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      driverName: driverDetails?.driverName,
      driverPhone: driverDetails?.driverPhone,
      vehicleRegistration: driverDetails?.vehicleRegistration,
      hasDriverDetails: !!driverDetails,
    });

    this.logger.log(`Journey reminder sent for booking ${booking.bookingReference}`);
  }
}

