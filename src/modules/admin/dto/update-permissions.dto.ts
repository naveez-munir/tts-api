import { z } from 'zod';
import { ControllerPermission } from '@prisma/client';

export const UpdatePermissionsSchema = z.object({
  permissions: z.array(z.nativeEnum(ControllerPermission)),
  reason: z.string().optional(),
});

export type UpdatePermissionsDto = z.infer<typeof UpdatePermissionsSchema>;
