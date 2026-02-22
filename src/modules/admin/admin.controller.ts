import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminService } from './admin.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UserRole, ControllerPermission, AuditAction, OperatorApprovalStatus } from '@prisma/client';

// DTOs
import { OperatorApprovalSchema, ListOperatorsQuerySchema } from './dto/operator-approval.dto.js';
import type { OperatorApprovalDto, ListOperatorsQueryDto } from './dto/operator-approval.dto.js';
import { CreatePricingRuleSchema, UpdatePricingRuleSchema } from './dto/pricing-rule.dto.js';
import type { CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/pricing-rule.dto.js';
import { ListBookingsQuerySchema, ListJobsQuerySchema, RefundBookingSchema } from './dto/admin-booking.dto.js';
import type { ListBookingsQueryDto, ListJobsQueryDto, RefundBookingDto } from './dto/admin-booking.dto.js';
import { ManualJobAssignmentSchema } from './dto/job-assignment.dto.js';
import type { ManualJobAssignmentDto } from './dto/job-assignment.dto.js';
import { ReportsQuerySchema } from './dto/reports-query.dto.js';
import type { ReportsQueryDto } from './dto/reports-query.dto.js';
import { UpdateSystemSettingSchema, BulkUpdateSettingsSchema } from './dto/system-settings.dto.js';
import type { UpdateSystemSettingDto, BulkUpdateSettingsDto } from './dto/system-settings.dto.js';
import { ListCustomersQuerySchema, UpdateCustomerStatusSchema, CustomerTransactionsQuerySchema, AddNoteSchema, EditNoteSchema } from './dto/customer-management.dto.js';
import type { ListCustomersQueryDto, UpdateCustomerStatusDto, CustomerTransactionsQueryDto, AddNoteDto, EditNoteDto } from './dto/customer-management.dto.js';
import { UpdateVehicleCapacitySchema } from '../vehicle-capacity/dto/vehicle-capacity.dto.js';
import type { UpdateVehicleCapacityDto } from '../vehicle-capacity/dto/vehicle-capacity.dto.js';
import { VehicleType } from '@prisma/client';
import { CreateControllerSchema } from './dto/create-controller.dto.js';
import type { CreateControllerDto } from './dto/create-controller.dto.js';
import { UpdatePermissionsSchema } from './dto/update-permissions.dto.js';
import type { UpdatePermissionsDto } from './dto/update-permissions.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CreateBookingSchema, CreateReturnBookingSchema } from '../bookings/dto/create-booking.dto.js';
import type { CreateBookingDto, CreateReturnBookingDto } from '../bookings/dto/create-booking.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  async getDashboard(@CurrentUser() user: { id: string; role: UserRole }) {
    const data = await this.adminService.getDashboard(user.role);
    return { success: true, data };
  }

  // =========================================================================
  // OPERATOR MANAGEMENT
  // =========================================================================

  @Get('operators')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.OPERATOR_VIEW)
  async listOperators(
    @Query(new ZodValidationPipe(ListOperatorsQuerySchema)) query: ListOperatorsQueryDto,
  ) {
    const result = await this.adminService.listOperators(query);
    return { success: true, data: { operators: result.operators }, meta: result.meta };
  }

  @Get('operators/:id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.OPERATOR_VIEW)
  async getOperatorById(@Param('id') id: string) {
    const data = await this.adminService.getOperatorById(id);
    return { success: true, data };
  }

  @Patch('operators/:id/approval')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.OPERATOR_APPROVE)
  async updateOperatorApproval(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OperatorApprovalSchema)) dto: OperatorApprovalDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.updateOperatorApproval(id, dto);

    // Determine audit action based on approval status
    let action: AuditAction;
    if (dto.approvalStatus === OperatorApprovalStatus.APPROVED) {
      action = AuditAction.OPERATOR_APPROVED;
    } else if (dto.approvalStatus === OperatorApprovalStatus.REJECTED) {
      action = AuditAction.OPERATOR_REJECTED;
    } else if (dto.approvalStatus === OperatorApprovalStatus.SUSPENDED) {
      action = AuditAction.OPERATOR_SUSPENDED;
    } else {
      action = AuditAction.OPERATOR_APPROVED; // fallback
    }

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action,
      targetType: 'Operator',
      targetId: id,
      description: `Operator ${dto.approvalStatus.toLowerCase()}`,
      newValue: { approvalStatus: dto.approvalStatus },
    });

    return { success: true, data };
  }

  /**
   * GET /admin/operators/:id/documents
   * Get all documents for a specific operator (with presigned download URLs)
   */
  @Get('operators/:id/documents')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.DOCUMENT_VIEW)
  async getOperatorDocuments(@Param('id') id: string) {
    const documents = await this.adminService.getOperatorDocuments(id);
    return { success: true, data: documents };
  }

  @Post('operators/:id/notes')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.OPERATOR_ADD_NOTE)
  async addOperatorNote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddNoteSchema)) dto: AddNoteDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.addOperatorNote(id, dto, user.id);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.OPERATOR_NOTE_ADDED,
      targetType: 'Operator',
      targetId: id,
      description: `Note added for operator ${id}`,
      newValue: { content: dto.content },
    });

    return { success: true, data };
  }

  @Patch('operators/:id/notes/:noteId')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.OPERATOR_EDIT_NOTE)
  async editOperatorNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(EditNoteSchema)) dto: EditNoteDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.editOperatorNote(id, noteId, dto);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.OPERATOR_NOTE_UPDATED,
      targetType: 'Operator',
      targetId: id,
      description: `Note updated for operator ${id}`,
      newValue: { noteId, content: dto.content },
    });

    return { success: true, data };
  }

  @Delete('operators/:id/notes/:noteId')
  @Roles(UserRole.ADMIN)
  async deleteOperatorNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    await this.adminService.deleteOperatorNote(id, noteId);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.OPERATOR_NOTE_UPDATED,
      targetType: 'Operator',
      targetId: id,
      description: `Note deleted for operator ${id}`,
      previousValue: { noteId },
    });

    return { success: true };
  }

  // =========================================================================
  // CUSTOMER MANAGEMENT
  // =========================================================================

  /**
   * GET /admin/customers
   * List all customers with search, filters, and pagination
   */
  @Get('customers')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.CUSTOMER_VIEW)
  async listCustomers(
    @Query(new ZodValidationPipe(ListCustomersQuerySchema)) query: ListCustomersQueryDto,
  ) {
    const result = await this.adminService.listCustomers(query);
    return { success: true, data: { customers: result.customers }, meta: result.meta };
  }

  /**
   * GET /admin/customers/:id
   * Get individual customer details with booking statistics
   */
  @Get('customers/:id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.CUSTOMER_VIEW)
  async getCustomerDetails(@Param('id') id: string) {
    const data = await this.adminService.getCustomerDetails(id);
    return { success: true, data };
  }

  /**
   * PATCH /admin/customers/:id/status
   * Update customer account status (activate/deactivate)
   */
  @Patch('customers/:id/status')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.CUSTOMER_UPDATE_STATUS)
  async updateCustomerStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCustomerStatusSchema)) dto: UpdateCustomerStatusDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.updateCustomerStatus(id, dto);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: dto.isActive ? AuditAction.CUSTOMER_ACTIVATED : AuditAction.CUSTOMER_DEACTIVATED,
      targetType: 'Customer',
      targetId: id,
      description: `Customer ${dto.isActive ? 'activated' : 'deactivated'}`,
      newValue: { isActive: dto.isActive },
      reason: dto.reason,
    });

    return { success: true, data };
  }

  /**
   * GET /admin/customers/:id/bookings
   * Get customer booking history with filters
   */
  @Get('customers/:id/bookings')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.CUSTOMER_VIEW_BOOKINGS)
  async getCustomerBookings(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListBookingsQuerySchema)) query: ListBookingsQueryDto,
  ) {
    const result = await this.adminService.getCustomerBookings(id, query);
    return { success: true, data: { bookings: result.bookings }, meta: result.meta };
  }

  @Post('customers/:id/bookings')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.BOOKING_CREATE)
  async createBookingForCustomer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateBookingSchema)) dto: CreateBookingDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const booking = await this.adminService.createBookingForCustomer(id, dto);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.BOOKING_CREATED,
      targetType: 'Booking',
      targetId: booking.id,
      description: `Booking created for customer ${id} by admin`,
      newValue: { bookingId: booking.id, customerId: id },
    });

    return { success: true, data: booking };
  }

  @Post('customers/:id/bookings/return')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.BOOKING_CREATE)
  async createReturnBookingForCustomer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateReturnBookingSchema)) dto: CreateReturnBookingDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const result = await this.adminService.createReturnBookingForCustomer(id, dto);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.BOOKING_CREATED,
      targetType: 'BookingGroup',
      targetId: result.bookingGroup.id,
      description: `Return journey created for customer ${id} by admin`,
      newValue: { bookingGroupId: result.bookingGroup.id, customerId: id },
    });

    return { success: true, data: result };
  }

  /**
   * GET /admin/customers/:id/transactions
   * Get customer transaction history
   */
  @Get('customers/:id/transactions')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.CUSTOMER_VIEW_TRANSACTIONS_LIMITED)
  async getCustomerTransactions(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(CustomerTransactionsQuerySchema)) query: CustomerTransactionsQueryDto,
  ) {
    const result = await this.adminService.getCustomerTransactions(id, query);
    return { success: true, data: { transactions: result.transactions, summary: result.summary }, meta: result.meta };
  }

  @Post('customers/:id/notes')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.CUSTOMER_ADD_NOTE)
  async addCustomerNote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddNoteSchema)) dto: AddNoteDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.addCustomerNote(id, dto, user.id);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.CUSTOMER_NOTE_ADDED,
      targetType: 'Customer',
      targetId: id,
      description: `Note added for customer ${id}`,
      newValue: { content: dto.content },
    });

    return { success: true, data };
  }

  @Patch('customers/:id/notes/:noteId')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.CUSTOMER_EDIT_NOTE)
  async editCustomerNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(EditNoteSchema)) dto: EditNoteDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.editCustomerNote(id, noteId, dto);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.CUSTOMER_NOTE_UPDATED,
      targetType: 'Customer',
      targetId: id,
      description: `Note updated for customer ${id}`,
      newValue: { noteId, content: dto.content },
    });

    return { success: true, data };
  }

  @Delete('customers/:id/notes/:noteId')
  @Roles(UserRole.ADMIN)
  async deleteCustomerNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    await this.adminService.deleteCustomerNote(id, noteId);

    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.CUSTOMER_NOTE_UPDATED,
      targetType: 'Customer',
      targetId: id,
      description: `Note deleted for customer ${id}`,
      previousValue: { noteId },
    });

    return { success: true };
  }

  // =========================================================================
  // BOOKING MANAGEMENT
  // =========================================================================

  @Get('bookings')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.BOOKING_VIEW)
  async listBookings(
    @Query(new ZodValidationPipe(ListBookingsQuerySchema)) query: ListBookingsQueryDto,
  ) {
    const result = await this.adminService.listBookings(query);
    return { success: true, data: { bookings: result.bookings }, meta: result.meta };
  }

  @Post('bookings/:id/refund')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.BOOKING_REFUND)
  @HttpCode(HttpStatus.OK)
  async refundBooking(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RefundBookingSchema)) dto: RefundBookingDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.refundBooking(id, dto);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.BOOKING_REFUNDED,
      targetType: 'Booking',
      targetId: id,
      description: `Booking refunded: ${dto.amount ? `£${dto.amount}` : 'full refund'}`,
      newValue: { amount: dto.amount, reason: dto.reason },
      reason: dto.reason,
    });

    return { success: true, data };
  }

  // =========================================================================
  // BOOKING GROUP MANAGEMENT (Return Journeys)
  // =========================================================================

  @Get('booking-groups')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.BOOKING_VIEW)
  async listBookingGroups(
    @Query(new ZodValidationPipe(ListBookingsQuerySchema)) query: ListBookingsQueryDto,
  ) {
    const result = await this.adminService.listBookingGroups(query);
    return { success: true, data: { bookingGroups: result.bookingGroups }, meta: result.meta };
  }

  @Get('booking-groups/:id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.BOOKING_VIEW)
  async getBookingGroup(@Param('id') id: string) {
    const data = await this.adminService.getBookingGroup(id);
    return { success: true, data };
  }

  // =========================================================================
  // JOB MANAGEMENT
  // =========================================================================

  @Get('jobs')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.JOB_VIEW)
  async listJobs(
    @Query(new ZodValidationPipe(ListJobsQuerySchema)) query: ListJobsQueryDto,
  ) {
    const result = await this.adminService.listJobs(query);
    return { success: true, data: { jobs: result.jobs }, meta: result.meta };
  }

  /**
   * GET /admin/jobs/escalated
   * List jobs that received no bids (need admin intervention)
   */
  @Get('jobs/escalated')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.JOB_VIEW)
  async listEscalatedJobs() {
    const data = await this.adminService.listEscalatedJobs();
    return { success: true, data };
  }

  /**
   * GET /admin/jobs/:jobId
   * Get job details with all bids
   */
  @Get('jobs/:jobId')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.JOB_VIEW)
  async getJobDetails(@Param('jobId') jobId: string) {
    const data = await this.adminService.getJobDetails(jobId);
    return { success: true, data };
  }

  /**
   * POST /admin/jobs/:jobId/assign
   * Manually assign a job to an operator (bypassing bidding)
   */
  @Post('jobs/:jobId/assign')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.JOB_ASSIGN)
  @HttpCode(HttpStatus.OK)
  async manualJobAssignment(
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(ManualJobAssignmentSchema)) dto: ManualJobAssignmentDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.manualJobAssignment(jobId, dto);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.JOB_ASSIGNED,
      targetType: 'Job',
      targetId: jobId,
      description: `Job manually assigned to operator ${dto.operatorId}`,
      newValue: { operatorId: dto.operatorId, bidAmount: dto.bidAmount },
      reason: dto.notes,
    });

    return { success: true, data };
  }

  /**
   * POST /admin/jobs/:jobId/close-bidding
   * Force close bidding window early and assign winner
   */
  @Post('jobs/:jobId/close-bidding')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.JOB_CLOSE_BIDDING)
  @HttpCode(HttpStatus.OK)
  async closeBiddingEarly(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.closeBiddingEarly(jobId);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.JOB_BIDDING_CLOSED,
      targetType: 'Job',
      targetId: jobId,
      description: 'Job bidding closed early by admin',
    });

    return { success: true, data };
  }

  /**
   * POST /admin/jobs/:jobId/reopen-bidding
   * Reopen bidding for a job that had no bids
   * Query param 'hours' is optional - defaults to REOPEN_BIDDING_DEFAULT_HOURS from SystemSettings
   */
  @Post('jobs/:jobId/reopen-bidding')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.JOB_REOPEN_BIDDING)
  @HttpCode(HttpStatus.OK)
  async reopenBidding(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
    @Query('hours') hours?: string,
  ) {
    const biddingHours = hours ? parseInt(hours, 10) : undefined;
    const data = await this.adminService.reopenBidding(jobId, biddingHours);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.JOB_BIDDING_REOPENED,
      targetType: 'Job',
      targetId: jobId,
      description: `Job bidding reopened${biddingHours ? ` for ${biddingHours} hours` : ''}`,
      newValue: { biddingHours },
    });

    return { success: true, data };
  }

  @Post('jobs/:jobId/confirm-completion')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.JOB_CONFIRM_COMPLETION)
  @HttpCode(HttpStatus.OK)
  async confirmJobCompletion(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.confirmJobCompletion(jobId);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.JOB_COMPLETION_CONFIRMED,
      targetType: 'Job',
      targetId: jobId,
      description: 'Job completion confirmed',
    });

    return { success: true, data };
  }

  @Post('jobs/:jobId/reject-completion')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.JOB_CONFIRM_COMPLETION)
  @HttpCode(HttpStatus.OK)
  async rejectJobCompletion(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
    @Query('reason') reason?: string,
  ) {
    const data = await this.adminService.rejectJobCompletion(jobId, reason);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.JOB_COMPLETION_REJECTED,
      targetType: 'Job',
      targetId: jobId,
      description: 'Job completion rejected',
      reason,
    });

    return { success: true, data };
  }

  // =========================================================================
  // PRICING RULES
  // =========================================================================

  @Get('pricing-rules')
  async listPricingRules() {
    const data = await this.adminService.listPricingRules();
    return { success: true, data };
  }

  @Post('pricing-rules')
  @HttpCode(HttpStatus.CREATED)
  async createPricingRule(
    @Body(new ZodValidationPipe(CreatePricingRuleSchema)) dto: CreatePricingRuleDto,
  ) {
    const data = await this.adminService.createPricingRule(dto);
    return { success: true, data };
  }

  @Patch('pricing-rules/:id')
  async updatePricingRule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePricingRuleSchema)) dto: UpdatePricingRuleDto,
  ) {
    const data = await this.adminService.updatePricingRule(id, dto);
    return { success: true, data };
  }

  @Delete('pricing-rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePricingRule(@Param('id') id: string) {
    await this.adminService.deletePricingRule(id);
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  @Get('reports/revenue')
  async getRevenueReport(
    @Query(new ZodValidationPipe(ReportsQuerySchema)) query: ReportsQueryDto,
  ) {
    const data = await this.adminService.getRevenueReport(query);
    return { success: true, data };
  }

  @Get('reports/payouts')
  async getPayoutsReport(
    @Query(new ZodValidationPipe(ReportsQuerySchema)) query: ReportsQueryDto,
  ) {
    const data = await this.adminService.getPayoutsReport(query);
    return { success: true, data };
  }

  // =========================================================================
  // SYSTEM SETTINGS MANAGEMENT
  // =========================================================================

  @Get('system-settings')
  async getAllSystemSettings() {
    const data = await this.adminService.getAllSystemSettings();
    return { success: true, data };
  }

  @Get('system-settings/category/:category')
  async getSystemSettingsByCategory(@Param('category') category: string) {
    const data = await this.adminService.getSystemSettingsByCategory(category);
    return { success: true, data };
  }

  @Patch('system-settings/:key')
  async updateSystemSetting(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(UpdateSystemSettingSchema)) dto: UpdateSystemSettingDto,
  ) {
    await this.adminService.updateSystemSetting(key, dto.value);
    return { success: true, message: 'System setting updated successfully' };
  }

  @Patch('system-settings')
  async bulkUpdateSystemSettings(
    @Body(new ZodValidationPipe(BulkUpdateSettingsSchema)) dto: BulkUpdateSettingsDto,
  ) {
    await this.adminService.bulkUpdateSystemSettings(dto.updates);
    return { success: true, message: 'System settings updated successfully' };
  }

  // =========================================================================
  // VEHICLE CAPACITY MANAGEMENT
  // =========================================================================

  /**
   * GET /admin/vehicle-capacities
   * List all vehicle capacities (including inactive)
   */
  @Get('vehicle-capacities')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.VEHICLE_VIEW)
  async listVehicleCapacities() {
    const data = await this.adminService.listVehicleCapacities();
    return { success: true, data };
  }

  /**
   * PATCH /admin/vehicle-capacities/:vehicleType
   * Update vehicle capacity configuration
   */
  @Patch('vehicle-capacities/:vehicleType')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.VEHICLE_UPDATE_CAPACITY)
  async updateVehicleCapacity(
    @Param('vehicleType') vehicleType: VehicleType,
    @Body(new ZodValidationPipe(UpdateVehicleCapacitySchema)) dto: UpdateVehicleCapacityDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const data = await this.adminService.updateVehicleCapacity(vehicleType, dto);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.VEHICLE_CAPACITY_UPDATED,
      targetType: 'VehicleCapacity',
      targetId: vehicleType,
      description: `Vehicle capacity updated for ${vehicleType}`,
      newValue: dto,
    });

    return { success: true, data };
  }

  @Get('drivers/pending')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.DRIVER_VIEW)
  async getPendingDrivers() {
    const drivers = await this.adminService.getPendingDrivers();
    return { success: true, data: drivers };
  }

  @Patch('drivers/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.DRIVER_APPROVE)
  @HttpCode(HttpStatus.OK)
  async approveDriver(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const driver = await this.adminService.approveDriver(id);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.DRIVER_APPROVED,
      targetType: 'Driver',
      targetId: id,
      description: 'Driver approved',
    });

    return { success: true, data: driver, message: 'Driver approved successfully' };
  }

  @Get('vehicles/pending')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.VEHICLE_VIEW)
  async getPendingVehicles() {
    const vehicles = await this.adminService.getPendingVehicles();
    return { success: true, data: vehicles };
  }

  @Patch('vehicles/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  @Permissions(ControllerPermission.VEHICLE_APPROVE)
  @HttpCode(HttpStatus.OK)
  async approveVehicle(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const vehicle = await this.adminService.approveVehicle(id);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.VEHICLE_APPROVED,
      targetType: 'Vehicle',
      targetId: id,
      description: 'Vehicle approved',
    });

    return { success: true, data: vehicle, message: 'Vehicle approved successfully' };
  }

  @Post('controllers')
  @HttpCode(HttpStatus.CREATED)
  async createController(
    @Body(new ZodValidationPipe(CreateControllerSchema)) dto: CreateControllerDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const controller = await this.adminService.createController(dto, user.id);

    // Audit log (controller is guaranteed to exist since we just created it)
    if (controller) {
      await this.auditService.log({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: AuditAction.CONTROLLER_CREATED,
        targetType: 'Controller',
        targetId: controller.id,
        description: `Controller account created for ${dto.email}`,
        newValue: { email: dto.email, permissions: dto.permissions },
      });
    }

    return { success: true, data: controller, message: 'Controller created successfully' };
  }

  @Get('controllers')
  async listControllers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    const result = await this.adminService.listControllers(
      pageNum,
      limitNum,
      search,
      isActiveBool,
    );
    return { success: true, data: result.controllers, pagination: result.pagination };
  }

  @Get('controllers/:id')
  async getControllerById(@Param('id') id: string) {
    const controller = await this.adminService.getControllerById(id);
    return { success: true, data: controller };
  }

  @Patch('controllers/:id/permissions')
  @HttpCode(HttpStatus.OK)
  async updateControllerPermissions(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePermissionsSchema)) dto: UpdatePermissionsDto,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const controller = await this.adminService.updateControllerPermissions(id, dto, user.id);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: AuditAction.CONTROLLER_PERMISSIONS_UPDATED,
      targetType: 'Controller',
      targetId: id,
      description: 'Controller permissions updated',
      newValue: { permissions: dto.permissions },
    });

    return { success: true, data: controller, message: 'Permissions updated successfully' };
  }

  @Patch('controllers/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateControllerStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() user: { id: string; email: string; role: UserRole },
  ) {
    const controller = await this.adminService.updateControllerStatus(id, isActive);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: isActive ? AuditAction.CONTROLLER_ACTIVATED : AuditAction.CONTROLLER_DEACTIVATED,
      targetType: 'Controller',
      targetId: id,
      description: `Controller ${isActive ? 'activated' : 'deactivated'}`,
      newValue: { isActive },
    });

    return { success: true, data: controller, message: 'Controller status updated successfully' };
  }

  @Get('controllers/:id/activity')
  async getControllerActivity(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.adminService.getControllerActivity(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
    return { success: true, data: result.logs, pagination: result.pagination };
  }
}

