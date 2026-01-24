import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BidsService } from './bids.service.js';
import { CreateBidSchema } from './dto/create-bid.dto.js';
import type { CreateBidDto } from './dto/create-bid.dto.js';
import { PrismaService } from '../../database/prisma.service.js';

@Controller('bids')
@UseGuards(JwtAuthGuard)
export class BidsController {
  constructor(
    private readonly bidsService: BidsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateBidSchema)) createBidDto: CreateBidDto,
  ) {
    // Get operator profile ID from user ID
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const bid = await this.bidsService.create(profile.id, createBidDto);
    return {
      success: true,
      data: bid,
    };
  }

  // ============================================================================
  // SPECIFIC ROUTES (must come BEFORE parameterized :id routes)
  // ============================================================================

  @Get('job/:jobId')
  async findJobBids(@Param('jobId') jobId: string) {
    const bids = await this.bidsService.findJobBids(jobId);
    return {
      success: true,
      data: bids,
      meta: {
        total: bids.length,
      },
    };
  }

  /**
   * GET /bids/operator/my-bids
   * Get all bids submitted by the current operator
   */
  @Get('operator/my-bids')
  async getOperatorBids(@CurrentUser() user: any) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const bids = await this.bidsService.findOperatorBids(profile.id);

    return {
      success: true,
      data: bids,
      meta: { total: bids.length },
    };
  }

  // ============================================================================
  // PARAMETERIZED ROUTES (must come AFTER specific routes)
  // ============================================================================

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const bid = await this.bidsService.findOne(id);
    return {
      success: true,
      data: bid,
    };
  }

  /**
   * POST /bids/:id/withdraw
   * Withdraw a bid
   */
  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  async withdrawBid(@CurrentUser() user: any, @Param('id') id: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const bid = await this.bidsService.withdrawBid(id, profile.id);

    return {
      success: true,
      data: bid,
      message: 'Bid withdrawn successfully',
    };
  }

  /**
   * POST /bids/:id/accept
   * Accept a job offer (for winning bid that's been offered)
   */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptBid(@CurrentUser() user: any, @Param('id') id: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const result = await this.bidsService.acceptJobOffer(id, profile.id);

    return {
      success: true,
      data: result,
      message: 'Job accepted successfully. Please submit driver details.',
    };
  }

  /**
   * POST /bids/:id/decline
   * Decline a job offer (for winning bid that's been offered)
   */
  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  async declineBid(@CurrentUser() user: any, @Param('id') id: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Operator profile not found');
    }

    const result = await this.bidsService.declineJobOffer(id, profile.id);

    return {
      success: true,
      data: result,
      message: 'Job declined. It will be offered to the next bidder.',
    };
  }
}

