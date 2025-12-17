import { z } from 'zod';

export const CreateJobSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  biddingWindowHours: z.number().min(1).max(24).optional().default(2),
});

export type CreateJobDto = z.infer<typeof CreateJobSchema>;

