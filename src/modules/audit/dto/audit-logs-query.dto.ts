import { z } from 'zod';
import { AuditAction } from '@prisma/client';

export const AuditLogsQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AuditLogsQueryDto = z.infer<typeof AuditLogsQuerySchema>;
