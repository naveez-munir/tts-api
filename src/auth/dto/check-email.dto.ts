import { z } from 'zod';

export const CheckEmailSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export type CheckEmailDto = z.infer<typeof CheckEmailSchema>;
