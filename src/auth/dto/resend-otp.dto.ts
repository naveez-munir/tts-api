import { z } from 'zod';

export const ResendOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  type: z.enum(['PASSWORD_RESET', 'EMAIL_VERIFICATION']),
});

export type ResendOtpDto = z.infer<typeof ResendOtpSchema>;
