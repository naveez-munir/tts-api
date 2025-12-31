import { z } from 'zod';

export const CreatePaymentIntentSchema = z.object({
  bookingId: z.string().cuid('Invalid booking ID'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format'),
});

export type CreatePaymentIntentDto = z.infer<typeof CreatePaymentIntentSchema>;

export const ConfirmPaymentSchema = z.object({
  paymentIntentId: z.string().min(1, 'Payment intent ID required'),
  bookingId: z.string().cuid('Invalid booking ID'),
});

export type ConfirmPaymentDto = z.infer<typeof ConfirmPaymentSchema>;

