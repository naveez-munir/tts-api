import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { StripeService } from '../../integrations/stripe/stripe.service.js';
import { SystemSettingsService } from '../system-settings/system-settings.service.js';
import { BiddingQueueService } from '../../queue/bidding-queue.service.js';
import { S3Service } from '../../integrations/s3/s3.service.js';
import {
  JobStatus,
  BidStatus,
  TransactionType,
  TransactionStatus,
  BookingStatus,
  OperatorApprovalStatus,
  Prisma,
} from '@prisma/client';
import type { OperatorApprovalDto, ListOperatorsQueryDto } from './dto/operator-approval.dto.js';
import type { CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/pricing-rule.dto.js';
import type { ListBookingsQueryDto, RefundBookingDto } from './dto/admin-booking.dto.js';
import type { ManualJobAssignmentDto } from './dto/job-assignment.dto.js';
import type { ReportsQueryDto } from './dto/reports-query.dto.js';
import type { ListCustomersQueryDto, UpdateCustomerStatusDto, CustomerTransactionsQueryDto } from './dto/customer-management.dto.js';
import type { UpdateVehicleCapacityDto } from '../vehicle-capacity/dto/vehicle-capacity.dto.js';
import { VehicleType } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly biddingQueueService: BiddingQueueService,
    private readonly s3Service: S3Service,
  ) {}

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  async getDashboard() {
    const [
      totalBookings,
      totalRevenue,
      platformCommission,
      activeOperators,
      pendingApprovals,
      suspendedOperators,
      activeJobs,
      jobsWithNoBids,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.transaction.aggregate({
        where: { transactionType: 'CUSTOMER_PAYMENT', status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { transactionType: 'PLATFORM_COMMISSION', status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.operatorProfile.count({ where: { approvalStatus: OperatorApprovalStatus.APPROVED } }),
      this.prisma.operatorProfile.count({ where: { approvalStatus: OperatorApprovalStatus.PENDING } }),
      this.prisma.operatorProfile.count({ where: { approvalStatus: OperatorApprovalStatus.SUSPENDED } }),
      this.prisma.job.count({
        where: { status: { in: [JobStatus.OPEN_FOR_BIDDING, JobStatus.BIDDING_CLOSED] } },
      }),
      this.prisma.job.count({
        where: { status: JobStatus.NO_BIDS_RECEIVED },
      }),
    ]);

    // Recent activity
    const recentBookings = await this.prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, bookingReference: true, status: true, createdAt: true },
    });

    const recentActivity = recentBookings.map((b) => ({
      type: 'BOOKING',
      description: `Booking ${b.bookingReference} - ${b.status}`,
      timestamp: b.createdAt.toISOString(),
    }));

    // Alerts
    const alerts: Array<{ type: string; message: string; severity: 'INFO' | 'WARNING' | 'ERROR' }> = [];

    if (pendingApprovals > 0) {
      alerts.push({
        type: 'OPERATOR_APPROVAL',
        message: `${pendingApprovals} operator(s) pending approval`,
        severity: 'WARNING',
      });
    }

    if (jobsWithNoBids > 0) {
      alerts.push({
        type: 'NO_BIDS',
        message: `${jobsWithNoBids} job(s) with no bids - requires escalation`,
        severity: 'ERROR',
      });
    }

    if (suspendedOperators > 0) {
      alerts.push({
        type: 'SUSPENDED_OPERATORS',
        message: `${suspendedOperators} operator(s) currently suspended`,
        severity: 'INFO',
      });
    }

    return {
      kpis: {
        totalBookings,
        totalRevenue: Number(totalRevenue._sum.amount) || 0,
        platformCommission: Number(platformCommission._sum.amount) || 0,
        activeOperators,
        pendingOperatorApprovals: pendingApprovals,
        suspendedOperators,
        activeJobs,
        jobsWithNoBids,
      },
      recentActivity,
      alerts,
    };
  }

  // =========================================================================
  // OPERATOR MANAGEMENT
  // =========================================================================

  async listOperators(query: ListOperatorsQueryDto) {
    const { approvalStatus, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OperatorProfileWhereInput = {};

    if (approvalStatus) {
      // Map string to enum
      where.approvalStatus = approvalStatus as OperatorApprovalStatus;
    }

    if (search) {
      where.OR = [
        { id: { equals: search } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [operators, total] = await Promise.all([
      this.prisma.operatorProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { email: true, phoneNumber: true } },
          vehicles: { select: { id: true } },
          bids: { where: { status: BidStatus.PENDING }, select: { id: true } },
          serviceAreas: { select: { postcode: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.operatorProfile.count({ where }),
    ]);

    return {
      operators: operators.map((op) => ({
        id: op.id,
        companyName: op.companyName,
        registrationNumber: op.registrationNumber,
        vatNumber: op.vatNumber,
        approvalStatus: op.approvalStatus,
        reputationScore: Number(op.reputationScore),
        user: op.user,
        vehiclesCount: op.vehicles.length,
        activeBidsCount: op.bids.length,
        completedJobsCount: op.completedJobs,
        totalJobs: op.totalJobs,
        serviceAreas: op.serviceAreas.map((sa) => sa.postcode),
        hasBankDetails: !!(op.bankAccountName && op.bankAccountNumber && op.bankSortCode),
        createdAt: op.createdAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateOperatorApproval(operatorId: string, dto: OperatorApprovalDto) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: {
        serviceAreas: true,
        documents: true,
      },
    });

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    const validStatuses = Object.values(OperatorApprovalStatus);
    if (!validStatuses.includes(dto.approvalStatus as OperatorApprovalStatus)) {
      throw new BadRequestException(`Invalid approval status. Must be one of: ${validStatuses.join(', ')}`);
    }

    if (dto.approvalStatus === OperatorApprovalStatus.APPROVED) {
      const missingFields: string[] = [];

      if (!operator.companyName) missingFields.push('companyName');
      if (!operator.registrationNumber) missingFields.push('registrationNumber');
      if (!operator.operatingLicenseNumber) missingFields.push('operatingLicenseNumber');
      if (!operator.bankAccountName) missingFields.push('bankAccountName');
      if (!operator.bankAccountNumber) missingFields.push('bankAccountNumber');
      if (!operator.bankSortCode) missingFields.push('bankSortCode');
      if (!operator.vehicleTypes || operator.vehicleTypes.length === 0) missingFields.push('vehicleTypes');
      if (!operator.serviceAreas || operator.serviceAreas.length === 0) missingFields.push('serviceAreas');
      if (!operator.documents || operator.documents.length === 0) missingFields.push('documents');

      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Cannot approve operator. Missing required fields: ${missingFields.join(', ')}`,
        );
      }
    }

    const updated = await this.prisma.operatorProfile.update({
      where: { id: operatorId },
      data: { approvalStatus: dto.approvalStatus as OperatorApprovalStatus },
    });

    return {
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Suspend an operator (blocks them from bidding)
   */
  async suspendOperator(operatorId: string, reason?: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    if (operator.approvalStatus === OperatorApprovalStatus.SUSPENDED) {
      throw new BadRequestException('Operator is already suspended');
    }

    const updated = await this.prisma.operatorProfile.update({
      where: { id: operatorId },
      data: { approvalStatus: OperatorApprovalStatus.SUSPENDED },
    });

    return {
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      reason: reason || 'No reason provided',
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Reinstate a suspended operator
   */
  async reinstateOperator(operatorId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    if (operator.approvalStatus !== OperatorApprovalStatus.SUSPENDED) {
      throw new BadRequestException('Operator is not suspended');
    }

    const updated = await this.prisma.operatorProfile.update({
      where: { id: operatorId },
      data: { approvalStatus: OperatorApprovalStatus.APPROVED },
    });

    return {
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Reject an operator application
   */
  async rejectOperator(operatorId: string, reason?: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    if (operator.approvalStatus !== OperatorApprovalStatus.PENDING) {
      throw new BadRequestException('Can only reject pending operator applications');
    }

    const updated = await this.prisma.operatorProfile.update({
      where: { id: operatorId },
      data: { approvalStatus: OperatorApprovalStatus.REJECTED },
    });

    return {
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      reason: reason || 'Application rejected',
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Get documents for a specific operator (with presigned URLs)
   */
  async getOperatorDocuments(operatorId: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    const documents = await this.prisma.document.findMany({
      where: { operatorId },
      orderBy: { uploadedAt: 'desc' },
    });

    // Generate presigned download URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc: { id: string; documentType: string; fileName: string; fileUrl: string; uploadedAt: Date; expiresAt: Date | null }) => {
        let presignedUrl: string | undefined;
        let urlExpiresIn: number | undefined;

        try {
          // Extract S3 key from the stored fileUrl
          const s3Key = this.extractS3KeyFromUrl(doc.fileUrl);
          if (s3Key) {
            const downloadData = await this.s3Service.generateDownloadUrl(s3Key);
            presignedUrl = downloadData.downloadUrl;
            urlExpiresIn = downloadData.expiresIn;
          }
        } catch (error) {
          this.logger.warn(`Failed to generate download URL for document ${doc.id}: ${error}`);
        }

        return {
          id: doc.id,
          documentType: doc.documentType,
          fileName: doc.fileName,
          fileUrl: presignedUrl || doc.fileUrl,
          uploadedAt: doc.uploadedAt.toISOString(),
          expiresAt: doc.expiresAt?.toISOString() || null,
          urlExpiresIn,
        };
      }),
    );

    return documentsWithUrls;
  }

  /**
   * Extract S3 key from a stored file URL
   */
  private extractS3KeyFromUrl(fileUrl: string): string | null {
    try {
      // Handle both full S3 URLs and just the key
      if (fileUrl.startsWith('operators/')) {
        return fileUrl;
      }
      const url = new URL(fileUrl);
      // Remove leading slash from pathname
      return url.pathname.substring(1);
    } catch {
      return fileUrl; // Assume it's already a key
    }
  }

  // =========================================================================
  // CUSTOMER MANAGEMENT
  // =========================================================================

  /**
   * List all customers with search, filters, and pagination
   */
  async listCustomers(query: ListCustomersQueryDto) {
    const { search, isActive, sortBy, sortOrder, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: 'CUSTOMER', // Only show customers
    };

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Search by email, firstName, lastName
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    const [customers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          _count: {
            select: {
              bookings: true,
            },
          },
        },
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Get customer IDs for batch query
    const customerIds = customers.map((c) => c.id);

    // Single aggregated query to get total spent for all customers (fixes N+1 issue)
    const spentByCustomer = await this.prisma.transaction.groupBy({
      by: ['bookingId'],
      where: {
        transactionType: TransactionType.CUSTOMER_PAYMENT,
        status: TransactionStatus.COMPLETED,
        booking: {
          customerId: { in: customerIds },
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Get booking-to-customer mapping
    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId: { in: customerIds },
      },
      select: {
        id: true,
        customerId: true,
      },
    });

    // Build customer spending map
    const customerSpendingMap = new Map<string, number>();
    spentByCustomer.forEach((item) => {
      const booking = bookings.find((b) => b.id === item.bookingId);
      if (booking) {
        const currentTotal = customerSpendingMap.get(booking.customerId) || 0;
        customerSpendingMap.set(booking.customerId, currentTotal + Number(item._sum.amount || 0));
      }
    });

    // Map customers with stats
    const customersWithStats = customers.map((customer) => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: customer.phoneNumber,
      isActive: customer.isActive,
      isEmailVerified: customer.isEmailVerified,
      totalBookings: customer._count.bookings,
      totalSpent: customerSpendingMap.get(customer.id) || 0,
      registeredAt: customer.createdAt.toISOString(),
    }));

    return {
      customers: customersWithStats,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get individual customer details with booking statistics
   */
  async getCustomerDetails(customerId: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.role !== 'CUSTOMER') {
      throw new BadRequestException('User is not a customer');
    }

    // Get booking statistics
    const [totalBookings, completedBookings, cancelledBookings, totalSpent, recentBookings] = await Promise.all([
      this.prisma.booking.count({
        where: { customerId },
      }),
      this.prisma.booking.count({
        where: { customerId, status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { customerId, status: { in: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] } },
      }),
      this.prisma.transaction.aggregate({
        where: {
          transactionType: TransactionType.CUSTOMER_PAYMENT,
          status: TransactionStatus.COMPLETED,
          booking: { customerId },
        },
        _sum: { amount: true },
      }),
      this.prisma.booking.findMany({
        where: { customerId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          bookingReference: true,
          status: true,
          pickupAddress: true,
          dropoffAddress: true,
          pickupDatetime: true,
          customerPrice: true,
          vehicleType: true,
          journeyType: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phoneNumber: customer.phoneNumber,
        isActive: customer.isActive,
        isEmailVerified: customer.isEmailVerified,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      },
      statistics: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        activeBookings: totalBookings - completedBookings - cancelledBookings,
        totalSpent: Number(totalSpent._sum.amount) || 0,
      },
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        bookingReference: b.bookingReference,
        status: b.status,
        pickupAddress: b.pickupAddress,
        dropoffAddress: b.dropoffAddress,
        pickupDatetime: b.pickupDatetime.toISOString(),
        customerPrice: Number(b.customerPrice),
        vehicleType: b.vehicleType,
        journeyType: b.journeyType,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Update customer account status (activate/deactivate)
   */
  async updateCustomerStatus(customerId: string, dto: UpdateCustomerStatusDto) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true, isActive: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.role !== 'CUSTOMER') {
      throw new BadRequestException('User is not a customer');
    }

    const updated = await this.prisma.user.update({
      where: { id: customerId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt.toISOString(),
      message: dto.isActive ? 'Customer account activated' : 'Customer account deactivated',
    };
  }

  /**
   * Get customer booking history with filters
   */
  async getCustomerBookings(customerId: string, query: ListBookingsQueryDto) {
    // Verify customer exists
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.role !== 'CUSTOMER') {
      throw new BadRequestException('User is not a customer');
    }

    const { status, dateFrom, dateTo, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      customerId, // Filter by customer
    };

    if (status) {
      where.status = status as BookingStatus;
    }

    if (dateFrom || dateTo) {
      where.pickupDatetime = {};
      if (dateFrom) where.pickupDatetime.gte = new Date(dateFrom);
      if (dateTo) where.pickupDatetime.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { bookingReference: { contains: search, mode: 'insensitive' } },
        { pickupAddress: { contains: search, mode: 'insensitive' } },
        { dropoffAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          job: {
            include: {
              bids: { orderBy: { bidAmount: 'asc' }, take: 1 },
              assignedOperator: { select: { companyName: true } },
            },
          },
          transactions: true,
          bookingGroup: { select: { id: true, groupReference: true, status: true } },
          stops: { orderBy: { stopOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings: bookings.map((b) => ({
        ...b,
        customerPrice: Number(b.customerPrice),
        journeyInfo: {
          journeyType: b.journeyType,
          isReturnJourney: b.bookingGroupId !== null,
          groupReference: b.bookingGroup?.groupReference || null,
          groupStatus: b.bookingGroup?.status || null,
        },
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get customer transaction history
   */
  async getCustomerTransactions(customerId: string, query: CustomerTransactionsQueryDto) {
    // Verify customer exists
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.role !== 'CUSTOMER') {
      throw new BadRequestException('User is not a customer');
    }

    const { transactionType, status, dateFrom, dateTo, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      booking: {
        customerId, // Filter by customer
      },
    };

    if (transactionType) {
      where.transactionType = transactionType as TransactionType;
    }

    if (status) {
      where.status = status as TransactionStatus;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [transactions, total, totals] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          booking: {
            select: {
              bookingReference: true,
              pickupAddress: true,
              dropoffAddress: true,
              vehicleType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        transactionType: t.transactionType,
        amount: Number(t.amount),
        currency: t.currency,
        status: t.status,
        description: t.description,
        stripeTransactionId: t.stripeTransactionId,
        booking: t.booking,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt?.toISOString() || null,
      })),
      summary: {
        totalAmount: Number(totals._sum.amount) || 0,
        totalTransactions: total,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =========================================================================
  // BOOKING MANAGEMENT
  // =========================================================================

  async listBookings(query: ListBookingsQueryDto) {
    const { status, dateFrom, dateTo, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {};

    if (status) {
      where.status = status as BookingStatus;
    }

    if (dateFrom || dateTo) {
      where.pickupDatetime = {};
      if (dateFrom) where.pickupDatetime.gte = new Date(dateFrom);
      if (dateTo) where.pickupDatetime.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { bookingReference: { contains: search, mode: 'insensitive' } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
        { pickupAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: { select: { email: true, firstName: true, lastName: true } },
          job: {
            include: {
              bids: { orderBy: { bidAmount: 'asc' }, take: 1 },
            },
          },
          transactions: true,
          bookingGroup: { select: { id: true, groupReference: true, status: true } },
          stops: { orderBy: { stopOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    // Transform bookings to include journey info
    const bookingsWithJourneyInfo = bookings.map((b) => ({
      ...b,
      journeyInfo: {
        journeyType: b.journeyType,
        isReturnJourney: b.bookingGroupId !== null,
        groupReference: b.bookingGroup?.groupReference || null,
        groupStatus: b.bookingGroup?.status || null,
      },
    }));

    return {
      bookings: bookingsWithJourneyInfo,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async refundBooking(bookingId: string, dto: RefundBookingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { transactions: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === 'REFUNDED') {
      throw new BadRequestException('Booking already refunded');
    }

    const originalPayment = booking.transactions.find(
      (t) => t.transactionType === 'CUSTOMER_PAYMENT' && t.status === 'COMPLETED',
    );

    const refundAmount = dto.amount || Number(booking.customerPrice);

    // Process refund via Stripe if we have a payment intent
    if (originalPayment?.stripeTransactionId) {
      const amountInPence = Math.round(refundAmount * 100);
      await this.stripeService.refundPayment(
        originalPayment.stripeTransactionId,
        amountInPence,
        dto.reason,
      );
    }

    // Create refund transaction
    const refundTransaction = await this.prisma.transaction.create({
      data: {
        bookingId,
        amount: refundAmount,
        transactionType: TransactionType.REFUND,
        status: 'COMPLETED',
      },
    });

    // Update booking status
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'REFUNDED' },
    });

    // Update booking group status if part of return journey
    if (booking.bookingGroupId) {
      await this.updateBookingGroupStatus(booking.bookingGroupId);
    }

    return {
      refund: {
        id: refundTransaction.id,
        amount: refundAmount,
        status: refundTransaction.status,
        stripeRefundId: refundTransaction.stripeTransactionId,
      },
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
      },
    };
  }

  // =========================================================================
  // BOOKING GROUP MANAGEMENT (Return Journeys)
  // =========================================================================

  async listBookingGroups(query: ListBookingsQueryDto) {
    const { status, dateFrom, dateTo, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingGroupWhereInput = {};

    if (status) {
      where.status = status as any;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { groupReference: { contains: search, mode: 'insensitive' } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [groups, total] = await Promise.all([
      this.prisma.bookingGroup.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: { select: { email: true, firstName: true, lastName: true } },
          bookings: {
            orderBy: { journeyType: 'asc' },
            include: {
              job: { include: { bids: { orderBy: { bidAmount: 'asc' }, take: 1 } } },
              stops: { orderBy: { stopOrder: 'asc' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bookingGroup.count({ where }),
    ]);

    return {
      bookingGroups: groups.map((g) => ({
        id: g.id,
        groupReference: g.groupReference,
        status: g.status,
        totalPrice: Number(g.totalPrice),
        discountType: g.discountType,
        discountAmount: g.discountAmount ? Number(g.discountAmount) : null,
        customer: g.customer,
        bookings: g.bookings.map((b) => ({
          id: b.id,
          bookingReference: b.bookingReference,
          journeyType: b.journeyType,
          status: b.status,
          pickupAddress: b.pickupAddress,
          dropoffAddress: b.dropoffAddress,
          pickupDatetime: b.pickupDatetime.toISOString(),
          customerPrice: Number(b.customerPrice),
          job: b.job,
        })),
        createdAt: g.createdAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingGroup(groupId: string) {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: groupId },
      include: {
        customer: { select: { email: true, firstName: true, lastName: true, phoneNumber: true } },
        bookings: {
          orderBy: { journeyType: 'asc' },
          include: {
            job: {
              include: {
                bids: { orderBy: { bidAmount: 'asc' } },
              },
            },
            transactions: true,
            stops: { orderBy: { stopOrder: 'asc' } },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Booking group not found');
    }

    // Get assigned operator details if exists
    const result = {
      ...group,
      bookings: await Promise.all(
        group.bookings.map(async (booking) => {
          if (booking.job?.assignedOperatorId) {
            const operator = await this.prisma.operatorProfile.findUnique({
              where: { id: booking.job.assignedOperatorId },
              select: { companyName: true },
            });
            return {
              ...booking,
              job: { ...booking.job, assignedOperator: operator },
            };
          }
          return { ...booking, job: booking.job ? { ...booking.job, assignedOperator: null } : null };
        }),
      ),
    };

    return result;
  }

  private async updateBookingGroupStatus(groupId: string): Promise<void> {
    const group = await this.prisma.bookingGroup.findUnique({
      where: { id: groupId },
      include: { bookings: true },
    });

    if (!group) return;

    const statuses = group.bookings.map((b) => b.status);
    const allCancelled = statuses.every((s) => s === 'CANCELLED' || s === 'REFUNDED');
    const someCancelled = statuses.some((s) => s === 'CANCELLED' || s === 'REFUNDED');
    const allCompleted = statuses.every((s) => s === 'COMPLETED');

    let newStatus: 'ACTIVE' | 'PARTIALLY_CANCELLED' | 'FULLY_CANCELLED' | 'COMPLETED' = 'ACTIVE';

    if (allCancelled) {
      newStatus = 'FULLY_CANCELLED';
    } else if (someCancelled) {
      newStatus = 'PARTIALLY_CANCELLED';
    } else if (allCompleted) {
      newStatus = 'COMPLETED';
    }

    await this.prisma.bookingGroup.update({
      where: { id: groupId },
      data: { status: newStatus },
    });
  }

  // =========================================================================
  // JOB MANAGEMENT
  // =========================================================================

  /**
   * List all jobs with filters and pagination
   */
  async listJobs(query: ListBookingsQueryDto) {
    const { status, dateFrom, dateTo, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {};

    if (status) {
      where.status = status as JobStatus;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.booking = {
        OR: [
          { bookingReference: { contains: search, mode: 'insensitive' } },
          { pickupAddress: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        include: {
          booking: {
            select: {
              bookingReference: true,
              pickupAddress: true,
              dropoffAddress: true,
              pickupDatetime: true,
              customerPrice: true,
              vehicleType: true,
              customer: { select: { email: true, firstName: true, lastName: true } },
            },
          },
          bids: {
            orderBy: { bidAmount: 'asc' },
            include: {
              operator: { select: { id: true, companyName: true, reputationScore: true } },
            },
          },
          assignedOperator: { select: { id: true, companyName: true } },
          winningBid: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs: jobs.map((j) => ({
        id: j.id,
        status: j.status,
        booking: j.booking,
        bidsCount: j.bids.length,
        lowestBid: j.bids[0] ? Number(j.bids[0].bidAmount) : null,
        assignedOperator: j.assignedOperator,
        winningBid: j.winningBid ? { id: j.winningBid.id, amount: Number(j.winningBid.bidAmount) } : null,
        platformMargin: j.platformMargin ? Number(j.platformMargin) : null,
        biddingWindowOpensAt: j.biddingWindowOpensAt.toISOString(),
        biddingWindowClosesAt: j.biddingWindowClosesAt.toISOString(),
        createdAt: j.createdAt.toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detailed job info including all bids
   */
  async getJobDetails(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        booking: {
          include: {
            customer: { select: { email: true, firstName: true, lastName: true, phoneNumber: true } },
            transactions: true,
            stops: { orderBy: { stopOrder: 'asc' } },
          },
        },
        bids: {
          orderBy: { bidAmount: 'asc' },
          include: {
            operator: {
              select: {
                id: true,
                companyName: true,
                reputationScore: true,
                completedJobs: true,
                totalJobs: true,
              },
            },
          },
        },
        assignedOperator: { select: { id: true, companyName: true, reputationScore: true } },
        winningBid: true,
        driverDetails: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return {
      id: job.id,
      status: job.status,
      booking: {
        ...job.booking,
        customerPrice: Number(job.booking.customerPrice),
      },
      bids: job.bids.map((b) => ({
        id: b.id,
        operatorId: b.operatorId,
        operator: b.operator,
        bidAmount: Number(b.bidAmount),
        status: b.status,
        notes: b.notes,
        submittedAt: b.submittedAt.toISOString(),
      })),
      assignedOperator: job.assignedOperator,
      winningBid: job.winningBid
        ? { id: job.winningBid.id, amount: Number(job.winningBid.bidAmount) }
        : null,
      platformMargin: job.platformMargin ? Number(job.platformMargin) : null,
      driverDetails: job.driverDetails,
      biddingWindow: {
        opensAt: job.biddingWindowOpensAt.toISOString(),
        closesAt: job.biddingWindowClosesAt.toISOString(),
        durationHours: job.biddingWindowDurationHours,
        isOpen: job.status === JobStatus.OPEN_FOR_BIDDING && new Date() < job.biddingWindowClosesAt,
      },
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || null,
    };
  }

  /**
   * Force close bidding early and assign winner (if bids exist)
   */
  async closeBiddingEarly(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        booking: true,
        bids: {
          orderBy: [
            { bidAmount: 'asc' },
            { operator: { reputationScore: 'desc' } },
          ],
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.OPEN_FOR_BIDDING) {
      throw new BadRequestException('Job is not open for bidding');
    }

    // If no bids, mark as no bids received
    if (job.bids.length === 0) {
      const updated = await this.prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.NO_BIDS_RECEIVED },
      });

      return {
        job: { id: updated.id, status: updated.status },
        message: 'Bidding closed - no bids received',
        winner: null,
      };
    }

    // Get the lowest bid
    const lowestBid = job.bids[0];
    const customerPrice = Number(job.booking.customerPrice);
    const platformMargin = customerPrice - Number(lowestBid.bidAmount);

    // Assign winner
    const [updatedJob] = await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.ASSIGNED,
          assignedOperatorId: lowestBid.operatorId,
          winningBidId: lowestBid.id,
          platformMargin: platformMargin,
        },
      }),
      this.prisma.bid.update({
        where: { id: lowestBid.id },
        data: { status: BidStatus.WON },
      }),
      this.prisma.bid.updateMany({
        where: { jobId, id: { not: lowestBid.id }, status: BidStatus.PENDING },
        data: { status: BidStatus.LOST },
      }),
      this.prisma.booking.update({
        where: { id: job.bookingId },
        data: { status: 'ASSIGNED' },
      }),
    ]);

    return {
      job: { id: updatedJob.id, status: updatedJob.status },
      message: 'Bidding closed early - winner assigned',
      winner: {
        operatorId: lowestBid.operatorId,
        bidAmount: Number(lowestBid.bidAmount),
        platformMargin,
      },
    };
  }

  /**
   * Reopen bidding for a job that had no bids
   */
  async reopenBidding(jobId: string, biddingWindowHours?: number) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.NO_BIDS_RECEIVED) {
      throw new BadRequestException('Can only reopen bidding for jobs with no bids received');
    }

    // Get bidding window duration from SystemSettings if not provided
    const windowHours = biddingWindowHours ??
      await this.systemSettingsService.getSettingOrDefault('REOPEN_BIDDING_DEFAULT_HOURS', 24);

    const now = new Date();
    const newClosingTime = new Date();
    newClosingTime.setHours(newClosingTime.getHours() + windowHours);

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.OPEN_FOR_BIDDING,
        biddingWindowOpensAt: now,
        biddingWindowClosesAt: newClosingTime,
        biddingWindowDurationHours: windowHours,
      },
    });

    return {
      job: {
        id: updated.id,
        status: updated.status,
        biddingWindowOpensAt: updated.biddingWindowOpensAt.toISOString(),
        biddingWindowClosesAt: updated.biddingWindowClosesAt.toISOString(),
      },
      message: `Bidding reopened for ${biddingWindowHours} hours`,
    };
  }

  async manualJobAssignment(jobId: string, dto: ManualJobAssignmentDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { booking: true },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status === JobStatus.ASSIGNED || job.status === JobStatus.COMPLETED) {
      throw new BadRequestException('Job is already assigned or completed');
    }

    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id: dto.operatorId },
    });

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    if (operator.approvalStatus !== OperatorApprovalStatus.APPROVED) {
      throw new BadRequestException('Operator is not approved');
    }

    // Cancel scheduled bidding window close (if job was open for bidding)
    if (job.status === JobStatus.OPEN_FOR_BIDDING) {
      await this.biddingQueueService.cancelScheduledClose(jobId);
      this.logger.log(`Cancelled scheduled bidding close for job ${jobId} due to manual assignment`);
    }

    // Calculate platform margin
    const customerPrice = Number(job.booking.customerPrice);
    const platformMargin = customerPrice - dto.bidAmount;

    // Create bid for the operator (or update if exists)
    const bid = await this.prisma.bid.upsert({
      where: {
        jobId_operatorId: { jobId, operatorId: dto.operatorId },
      },
      update: {
        bidAmount: dto.bidAmount,
        status: BidStatus.WON,
      },
      create: {
        jobId,
        operatorId: dto.operatorId,
        bidAmount: dto.bidAmount,
        status: BidStatus.WON,
      },
    });

    // Mark other bids as lost
    await this.prisma.bid.updateMany({
      where: { jobId, id: { not: bid.id } },
      data: { status: BidStatus.LOST },
    });

    // Update job status with winning bid and platform margin
    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.ASSIGNED,
        assignedOperatorId: dto.operatorId,
        winningBidId: bid.id,
        platformMargin: platformMargin,
      },
    });

    // Update booking status
    await this.prisma.booking.update({
      where: { id: job.bookingId },
      data: { status: 'ASSIGNED' },
    });

    return {
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        winningBidId: bid.id,
        platformMargin: platformMargin,
      },
    };
  }

  /**
   * List jobs that need escalation (no bids received)
   */
  async listEscalatedJobs() {
    const jobs = await this.prisma.job.findMany({
      where: { status: JobStatus.NO_BIDS_RECEIVED },
      include: {
        booking: {
          select: {
            bookingReference: true,
            pickupAddress: true,
            dropoffAddress: true,
            pickupDatetime: true,
            customerPrice: true,
            vehicleType: true,
            customer: { select: { email: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      escalatedJobs: jobs.map((j) => ({
        id: j.id,
        booking: j.booking,
        biddingWindowClosedAt: j.biddingWindowClosesAt.toISOString(),
        createdAt: j.createdAt.toISOString(),
      })),
      count: jobs.length,
    };
  }

  // =========================================================================
  // PRICING RULES
  // =========================================================================

  async listPricingRules() {
    const rules = await this.prisma.pricingRule.findMany({
      orderBy: [{ ruleType: 'asc' }, { vehicleType: 'asc' }],
    });

    return {
      pricingRules: rules.map((r) => ({
        id: r.id,
        ruleType: r.ruleType,
        vehicleType: r.vehicleType,
        baseValue: Number(r.baseValue),
        description: r.description,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async createPricingRule(dto: CreatePricingRuleDto) {
    const rule = await this.prisma.pricingRule.create({
      data: {
        ruleType: dto.ruleType,
        vehicleType: dto.vehicleType || null,
        baseValue: dto.baseValue,
        description: dto.description || null,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      id: rule.id,
      ruleType: rule.ruleType,
      vehicleType: rule.vehicleType,
      baseValue: Number(rule.baseValue),
      description: rule.description,
      isActive: rule.isActive,
      createdAt: rule.createdAt.toISOString(),
    };
  }

  async updatePricingRule(ruleId: string, dto: UpdatePricingRuleDto) {
    const rule = await this.prisma.pricingRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }

    const updated = await this.prisma.pricingRule.update({
      where: { id: ruleId },
      data: {
        ruleType: dto.ruleType,
        vehicleType: dto.vehicleType,
        baseValue: dto.baseValue,
        description: dto.description,
        isActive: dto.isActive,
      },
    });

    return {
      id: updated.id,
      ruleType: updated.ruleType,
      vehicleType: updated.vehicleType,
      baseValue: Number(updated.baseValue),
      description: updated.description,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deletePricingRule(ruleId: string) {
    const rule = await this.prisma.pricingRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }

    await this.prisma.pricingRule.delete({
      where: { id: ruleId },
    });

    return { deleted: true };
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  async getRevenueReport(query: ReportsQueryDto) {
    const { dateFrom, dateTo } = query;

    const where: Prisma.TransactionWhereInput = {
      transactionType: 'CUSTOMER_PAYMENT',
      status: 'COMPLETED',
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [transactions, totals] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { booking: { select: { bookingReference: true, vehicleType: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Group by vehicle type
    const revenueByVehicleType: Record<string, number> = {};
    transactions.forEach((t) => {
      const vt = t.booking.vehicleType;
      revenueByVehicleType[vt] = (revenueByVehicleType[vt] || 0) + Number(t.amount);
    });

    return {
      summary: {
        totalRevenue: Number(totals._sum.amount) || 0,
        totalTransactions: totals._count.id,
        period: {
          from: dateFrom || 'all-time',
          to: dateTo || 'now',
        },
      },
      revenueByVehicleType,
      recentTransactions: transactions.slice(0, 20).map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        bookingReference: t.booking.bookingReference,
        vehicleType: t.booking.vehicleType,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async getPayoutsReport(query: ReportsQueryDto) {
    const { dateFrom, dateTo } = query;

    const where: Prisma.TransactionWhereInput = {
      transactionType: 'OPERATOR_PAYOUT',
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [payouts, totals] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          booking: {
            select: {
              bookingReference: true,
              job: {
                select: {
                  assignedOperatorId: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      summary: {
        totalPayouts: Number(totals._sum.amount) || 0,
        totalPayoutCount: totals._count.id,
        period: {
          from: dateFrom || 'all-time',
          to: dateTo || 'now',
        },
      },
      recentPayouts: payouts.slice(0, 20).map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        bookingReference: p.booking.bookingReference,
        operatorId: p.booking.job?.assignedOperatorId,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  // =========================================================================
  // SYSTEM SETTINGS MANAGEMENT
  // =========================================================================

  async getAllSystemSettings() {
    return this.systemSettingsService.getAllSettings();
  }

  async getSystemSettingsByCategory(category: string) {
    return this.systemSettingsService.getSettingsByCategory(category);
  }

  async updateSystemSetting(key: string, value: any): Promise<void> {
    await this.systemSettingsService.updateSetting(key, value);
  }

  async bulkUpdateSystemSettings(updates: Array<{ key: string; value: any }>): Promise<void> {
    await this.systemSettingsService.bulkUpdateSettings(updates);
  }

  // =========================================================================
  // VEHICLE CAPACITY MANAGEMENT
  // =========================================================================

  /**
   * List all vehicle capacities (including inactive)
   */
  async listVehicleCapacities() {
    const capacities = await this.prisma.vehicleCapacity.findMany({
      orderBy: { vehicleType: 'asc' },
    });

    return {
      vehicleCapacities: capacities.map((c) => ({
        id: c.id,
        vehicleType: c.vehicleType,
        maxPassengers: c.maxPassengers,
        maxPassengersHandOnly: c.maxPassengersHandOnly,
        maxSuitcases: c.maxSuitcases,
        maxHandLuggage: c.maxHandLuggage,
        exampleModels: c.exampleModels,
        description: c.description,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Update a vehicle capacity configuration
   */
  async updateVehicleCapacity(vehicleType: VehicleType, dto: UpdateVehicleCapacityDto) {
    const existing = await this.prisma.vehicleCapacity.findUnique({
      where: { vehicleType },
    });

    if (!existing) {
      throw new NotFoundException(`Vehicle capacity for type ${vehicleType} not found`);
    }

    const updated = await this.prisma.vehicleCapacity.update({
      where: { vehicleType },
      data: {
        maxPassengers: dto.maxPassengers,
        maxPassengersHandOnly: dto.maxPassengersHandOnly,
        maxSuitcases: dto.maxSuitcases,
        maxHandLuggage: dto.maxHandLuggage,
        exampleModels: dto.exampleModels,
        description: dto.description,
        isActive: dto.isActive,
      },
    });

    return {
      id: updated.id,
      vehicleType: updated.vehicleType,
      maxPassengers: updated.maxPassengers,
      maxPassengersHandOnly: updated.maxPassengersHandOnly,
      maxSuitcases: updated.maxSuitcases,
      maxHandLuggage: updated.maxHandLuggage,
      exampleModels: updated.exampleModels,
      description: updated.description,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

