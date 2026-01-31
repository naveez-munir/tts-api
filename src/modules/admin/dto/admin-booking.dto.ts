import { z } from 'zod';

export const ListBookingsQuerySchema = z.object({
  status: z.enum(['PENDING_PAYMENT', 'PAID', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUNDED']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type ListBookingsQueryDto = z.infer<typeof ListBookingsQuerySchema>;

export const ListJobsQuerySchema = z.object({
  status: z.enum(['OPEN_FOR_BIDDING', 'BIDDING_CLOSED', 'NO_BIDS_RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PENDING_ACCEPTANCE']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type ListJobsQueryDto = z.infer<typeof ListJobsQuerySchema>;

export const RefundBookingSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(1, 'Reason is required'),
});

export type RefundBookingDto = z.infer<typeof RefundBookingSchema>;

