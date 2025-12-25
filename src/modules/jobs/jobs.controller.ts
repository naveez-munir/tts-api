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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { JobsService } from './jobs.service.js';
import { CreateJobSchema } from './dto/create-job.dto.js';
import type { CreateJobDto } from './dto/create-job.dto.js';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateJobSchema)) createJobDto: CreateJobDto,
  ) {
    const job = await this.jobsService.createFromBooking(
      createJobDto.bookingId,
      createJobDto.biddingWindowHours,
    );
    return {
      success: true,
      data: job,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const job = await this.jobsService.findOne(id);
    return {
      success: true,
      data: job,
    };
  }

  @Get('available/:postcode')
  async findAvailableJobs(@Param('postcode') postcode: string) {
    const jobs = await this.jobsService.findAvailableJobs(postcode);
    return {
      success: true,
      data: jobs,
      meta: {
        total: jobs.length,
      },
    };
  }

  @Post(':id/assign-winner')
  async assignWinningBid(@Param('id') id: string) {
    const job = await this.jobsService.assignWinningBid(id);
    return {
      success: true,
      data: job,
      message: 'Winning bid assigned successfully',
    };
  }
}

