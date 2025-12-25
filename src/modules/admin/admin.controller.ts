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
import { ListBookingsQuerySchema, RefundBookingSchema } from './dto/admin-booking.dto.js';
import type { ListBookingsQueryDto, RefundBookingDto } from './dto/admin-booking.dto.js';
import { ManualJobAssignmentSchema } from './dto/job-assignment.dto.js';
import type { ManualJobAssignmentDto } from './dto/job-assignment.dto.js';
import { ReportsQuerySchema } from './dto/reports-query.dto.js';
import type { ReportsQueryDto } from './dto/reports-query.dto.js';

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

  @Patch('operators/:id/approval')
  async updateOperatorApproval(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OperatorApprovalSchema)) dto: OperatorApprovalDto,
  ) {
    const data = await this.adminService.updateOperatorApproval(id, dto);
    return { success: true, data };
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

  /**
   * GET /admin/jobs
   * List all jobs with filters
   */
  @Get('jobs')
  async listJobs(
    @Query(new ZodValidationPipe(ListBookingsQuerySchema)) query: ListBookingsQueryDto,
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
   */
  @Post('jobs/:jobId/reopen-bidding')
  @HttpCode(HttpStatus.OK)
  async reopenBidding(
    @Param('jobId') jobId: string,
    @Query('hours') hours?: string,
  ) {
    const biddingHours = hours ? parseInt(hours, 10) : 24;
    const data = await this.adminService.reopenBidding(jobId, biddingHours);
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
}

