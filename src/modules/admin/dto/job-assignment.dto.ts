import { z } from 'zod';

export const ManualJobAssignmentSchema = z.object({
  operatorId: z.string().min(1, 'Operator ID is required'),
  bidAmount: z.number().positive('Bid amount must be positive'),
  notes: z.string().optional(),
});

export type ManualJobAssignmentDto = z.infer<typeof ManualJobAssignmentSchema>;

