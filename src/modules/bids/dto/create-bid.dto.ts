import { z } from 'zod';

export const CreateBidSchema = z.object({
  jobId: z.string().cuid('Invalid job ID'),
  bidAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid bid amount format'),
  notes: z.string().optional(),
});

export type CreateBidDto = z.infer<typeof CreateBidSchema>;

