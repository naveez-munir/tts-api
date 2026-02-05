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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminService } from './admin.service.js';
import { UserRole } from '@prisma/client';

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
import { ListCustomersQuerySchema, UpdateCustomerStatusSchema, CustomerTransactionsQuerySchema } from './dto/customer-management.dto.js';
import type { ListCustomersQueryDto, UpdateCustomerStatusDto, CustomerTransactionsQueryDto } from './dto/customer-management.dto.js';
import { UpdateVehicleCapacitySchema } from '../vehicle-capacity/dto/vehicle-capacity.dto.js';
import type { UpdateVehicleCapacityDto } from '../vehicle-capacity/dto/vehicle-capacity.dto.js';
import { VehicleType } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  @Get('dashboard')
  async getDashboard() {
    const data = await this.adminService.getDashboard();
    return { success: true, data };
  }

  // =========================================================================
  // OPERATOR MANAGEMENT
  // =========================================================================

  @Get('operators')
  async listOperators(
    @Query(new ZodValidationPipe(ListOperatorsQuerySchema)) query: ListOperatorsQueryDto,
  ) {
    const result = await this.adminService.listOperators(query);
    return { success: true, data: { operators: result.operators }, meta: result.meta };
  }

  @Get('operators/:id')
  async getOperatorById(@Param('id') id: string) {
    const data = await this.adminService.getOperatorById(id);
    return { success: true, data };
  }

  @Patch('operators/:id/approval')
  async updateOperatorApproval(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OperatorApprovalSchema)) dto: OperatorApprovalDto,
  ) {
    const data = await this.adminService.updateOperatorApproval(id, dto);
    return { success: true, data };
  }

  /**
   * GET /admin/operators/:id/documents
   * Get all documents for a specific operator (with presigned download URLs)
   */
  @Get('operators/:id/documents')
  async getOperatorDocuments(@Param('id') id: string) {
    const documents = await this.adminService.getOperatorDocuments(id);
    return { success: true, data: documents };
  }

  // =========================================================================
  // CUSTOMER MANAGEMENT
  // =========================================================================

  /**
   * GET /admin/customers
   * List all customers with search, filters, and pagination
   */
  @Get('customers')
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
  async getCustomerDetails(@Param('id') id: string) {
    const data = await this.adminService.getCustomerDetails(id);
    return { success: true, data };
  }

  /**
   * PATCH /admin/customers/:id/status
   * Update customer account status (activate/deactivate)
   */
  @Patch('customers/:id/status')
  async updateCustomerStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCustomerStatusSchema)) dto: UpdateCustomerStatusDto,
  ) {
    const data = await this.adminService.updateCustomerStatus(id, dto);
    return { success: true, data };
  }

  /**
   * GET /admin/customers/:id/bookings
   * Get customer booking history with filters
   */
  @Get('customers/:id/bookings')
  async getCustomerBookings(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ListBookingsQuerySchema)) query: ListBookingsQueryDto,
  ) {
    const result = await this.adminService.getCustomerBookings(id, query);
    return { success: true, data: { bookings: result.bookings }, meta: result.meta };
  }

  /**
   * GET /admin/customers/:id/transactions
   * Get customer transaction history
   */
  @Get('customers/:id/transactions')
  async getCustomerTransactions(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(CustomerTransactionsQuerySchema)) query: CustomerTransactionsQueryDto,
  ) {
    const result = await this.adminService.getCustomerTransactions(id, query);
    return { success: true, data: { transactions: result.transactions, summary: result.summary }, meta: result.meta };
  }

  // =========================================================================
  // BOOKING MANAGEMENT
  // =========================================================================

  @Get('bookings')
  async listBookings(
    @Query(new ZodValidationPipe(ListBookingsQuerySchema)) query: ListBookingsQueryDto,
  ) {
    const result = await this.adminService.listBookings(query);
    return { success: true, data: { bookings: result.bookings }, meta: result.meta };
  }

  @Post('bookings/:id/refund')
  @HttpCode(HttpStatus.OK)
  async refundBooking(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RefundBookingSchema)) dto: RefundBookingDto,
  ) {
    const data = await this.adminService.refundBooking(id, dto);
    return { success: true, data };
  }

  // =========================================================================
  // BOOKING GROUP MANAGEMENT (Return Journeys)
  // =========================================================================

  @Get('booking-groups')
  async listBookingGroups(
    @Query(new ZodValidationPipe(ListBookingsQuerySchema)) query: ListBookingsQueryDto,
  ) {
    const result = await this.adminService.listBookingGroups(query);
    return { success: true, data: { bookingGroups: result.bookingGroups }, meta: result.meta };
  }

  @Get('booking-groups/:id')
  async getBookingGroup(@Param('id') id: string) {
    const data = await this.adminService.getBookingGroup(id);
    return { success: true, data };
  }

  // =========================================================================
  // JOB MANAGEMENT
  // =========================================================================

  @Get('jobs')
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
  async listEscalatedJobs() {
    const data = await this.adminService.listEscalatedJobs();
    return { success: true, data };
  }

  /**
   * GET /admin/jobs/:jobId
   * Get job details with all bids
   */
  @Get('jobs/:jobId')
  async getJobDetails(@Param('jobId') jobId: string) {
    const data = await this.adminService.getJobDetails(jobId);
    return { success: true, data };
  }

  /**
   * POST /admin/jobs/:jobId/assign
   * Manually assign a job to an operator (bypassing bidding)
   */
  @Post('jobs/:jobId/assign')
  @HttpCode(HttpStatus.OK)
  async manualJobAssignment(
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(ManualJobAssignmentSchema)) dto: ManualJobAssignmentDto,
  ) {
    const data = await this.adminService.manualJobAssignment(jobId, dto);
    return { success: true, data };
  }

  /**
   * POST /admin/jobs/:jobId/close-bidding
   * Force close bidding window early and assign winner
   */
  @Post('jobs/:jobId/close-bidding')
  @HttpCode(HttpStatus.OK)
  async closeBiddingEarly(@Param('jobId') jobId: string) {
    const data = await this.adminService.closeBiddingEarly(jobId);
    return { success: true, data };
  }

  /**
   * POST /admin/jobs/:jobId/reopen-bidding
   * Reopen bidding for a job that had no bids
   * Query param 'hours' is optional - defaults to REOPEN_BIDDING_DEFAULT_HOURS from SystemSettings
   */
  @Post('jobs/:jobId/reopen-bidding')
  @HttpCode(HttpStatus.OK)
  async reopenBidding(
    @Param('jobId') jobId: string,
    @Query('hours') hours?: string,
  ) {
    const biddingHours = hours ? parseInt(hours, 10) : undefined;
    const data = await this.adminService.reopenBidding(jobId, biddingHours);
    return { success: true, data };
  }

  @Post('jobs/:jobId/confirm-completion')
  @HttpCode(HttpStatus.OK)
  async confirmJobCompletion(@Param('jobId') jobId: string) {
    const data = await this.adminService.confirmJobCompletion(jobId);
    return { success: true, data };
  }

  @Post('jobs/:jobId/reject-completion')
  @HttpCode(HttpStatus.OK)
  async rejectJobCompletion(
    @Param('jobId') jobId: string,
    @Query('reason') reason?: string,
  ) {
    const data = await this.adminService.rejectJobCompletion(jobId, reason);
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
  async listVehicleCapacities() {
    const data = await this.adminService.listVehicleCapacities();
    return { success: true, data };
  }

  /**
   * PATCH /admin/vehicle-capacities/:vehicleType
   * Update vehicle capacity configuration
   */
  @Patch('vehicle-capacities/:vehicleType')
  async updateVehicleCapacity(
    @Param('vehicleType') vehicleType: VehicleType,
    @Body(new ZodValidationPipe(UpdateVehicleCapacitySchema)) dto: UpdateVehicleCapacityDto,
  ) {
    const data = await this.adminService.updateVehicleCapacity(vehicleType, dto);
    return { success: true, data };
  }
}

