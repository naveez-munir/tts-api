import { z } from 'zod';

export const ReportsQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export type ReportsQueryDto = z.infer<typeof ReportsQuerySchema>;

