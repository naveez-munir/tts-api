import { z } from 'zod';

export const OperatorApprovalSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']),
  notes: z.string().optional(),
});

export type OperatorApprovalDto = z.infer<typeof OperatorApprovalSchema>;

// Query params for listing operators
export const ListOperatorsQuerySchema = z.object({
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type ListOperatorsQueryDto = z.infer<typeof ListOperatorsQuerySchema>;

