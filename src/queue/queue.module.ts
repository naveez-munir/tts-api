import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const BIDDING_QUEUE = 'bidding-queue';
export const ACCEPTANCE_QUEUE = 'acceptance-queue';

/**
 * Core BullMQ module - sets up Redis connection globally
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue({
      name: BIDDING_QUEUE,
    }),
    BullModule.registerQueue({
      name: ACCEPTANCE_QUEUE,
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}

