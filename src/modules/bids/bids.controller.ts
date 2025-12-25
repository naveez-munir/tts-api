import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BidsService } from './bids.service.js';
import { CreateBidSchema } from './dto/create-bid.dto.js';
import type { CreateBidDto } from './dto/create-bid.dto.js';

@Controller('bids')
@UseGuards(JwtAuthGuard)
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateBidSchema)) createBidDto: CreateBidDto,
  ) {
    const bid = await this.bidsService.create(user.id, createBidDto);
    return {
      success: true,
      data: bid,
    };
  }

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

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const bid = await this.bidsService.findOne(id);
    return {
      success: true,
      data: bid,
    };
  }
}

