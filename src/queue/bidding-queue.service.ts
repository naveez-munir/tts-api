import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BIDDING_QUEUE } from './queue.module.js';
import type { CloseBiddingJobData } from './bidding.processor.js';

@Injectable()
export class BiddingQueueService {
  private readonly logger = new Logger(BiddingQueueService.name);

  constructor(
    @InjectQueue(BIDDING_QUEUE) private readonly biddingQueue: Queue<CloseBiddingJobData>,
  ) {}

  /**
   * Schedule job to close bidding window at specified time
   */
  async scheduleBiddingWindowClose(jobId: string, closesAt: Date): Promise<void> {
    const delay = closesAt.getTime() - Date.now();

    if (delay <= 0) {
      this.logger.warn(`Bidding window for job ${jobId} already expired, processing immediately`);
      await this.biddingQueue.add(
        'close-bidding',
        { jobId },
        { jobId: `close-bidding-${jobId}` },
      );
      return;
    }

    await this.biddingQueue.add(
      'close-bidding',
      { jobId },
      {
        delay,
        jobId: `close-bidding-${jobId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Scheduled bidding window close for job ${jobId} at ${closesAt.toISOString()} (delay: ${Math.round(delay / 1000 / 60)} minutes)`,
    );
  }

  /**
   * Cancel scheduled bidding close (e.g., if admin closes early)
   */
  async cancelScheduledClose(jobId: string): Promise<void> {
    const job = await this.biddingQueue.getJob(`close-bidding-${jobId}`);
    if (job) {
      await job.remove();
      this.logger.log(`Cancelled scheduled bidding close for job ${jobId}`);
    }
  }
}

