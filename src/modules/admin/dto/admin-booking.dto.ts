import { z } from 'zod';

// Query params for listing bookings
export const ListBookingsQuerySchema = z.object({
  status: z.enum(['PENDING_PAYMENT', 'PAID', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUNDED']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type ListBookingsQueryDto = z.infer<typeof ListBookingsQuerySchema>;

// Refund request
export const RefundBookingSchema = z.object({
  amount: z.number().positive().optional(), // Optional: partial refund (default: full refund)
  reason: z.string().min(1, 'Reason is required'),
});

export type RefundBookingDto = z.infer<typeof RefundBookingSchema>;

