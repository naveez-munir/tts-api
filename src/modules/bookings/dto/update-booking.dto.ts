import { z } from 'zod';

export const UpdateBookingSchema = z.object({
  pickupDatetime: z.string().datetime().optional(),
  passengerCount: z.number().min(1).max(16).optional(),
  luggageCount: z.number().min(0).optional(),
  specialRequirements: z.string().optional(),
}).strict();

export type UpdateBookingDto = z.infer<typeof UpdateBookingSchema>;

