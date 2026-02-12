import { z } from 'zod';
import { AuditAction, UserRole } from '@prisma/client';

export const CreateAuditLogSchema = z.object({
  userId: z.string(),
  userEmail: z.string().email(),
  userRole: z.nativeEnum(UserRole),
  action: z.nativeEnum(AuditAction),
  targetType: z.string(),
  targetId: z.string(),
  description: z.string(),
  previousValue: z.any().optional(),
  newValue: z.any().optional(),
  reason: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type CreateAuditLogDto = z.infer<typeof CreateAuditLogSchema>;
