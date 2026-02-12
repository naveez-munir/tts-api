import { z } from 'zod';
import { ControllerPermission } from '@prisma/client';

export const CreateControllerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  permissions: z.array(z.nativeEnum(ControllerPermission)).min(1, 'At least one permission required'),
});

export type CreateControllerDto = z.infer<typeof CreateControllerSchema>;
