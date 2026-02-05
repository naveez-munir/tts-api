import { z } from 'zod';

export const UpdateCustomerProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phoneNumber: z.string().optional(),
});

export type UpdateCustomerProfileDto = z.infer<typeof UpdateCustomerProfileSchema>;

