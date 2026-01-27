import { z } from 'zod';

export const SendVerificationOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export type SendVerificationOtpDto = z.infer<typeof SendVerificationOtpSchema>;
