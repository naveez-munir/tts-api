import { z } from 'zod';

// Query params for listing customers
export const ListCustomersQuerySchema = z.object({
  search: z.string().optional(), // Search by email, firstName, lastName
  isActive: z.enum(['true', 'false']).optional(), // Filter by account status
  sortBy: z.enum(['createdAt', 'lastName', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type ListCustomersQueryDto = z.infer<typeof ListCustomersQuerySchema>;

// Update customer account status
export const UpdateCustomerStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(), // Optional reason for deactivation
});

export type UpdateCustomerStatusDto = z.infer<typeof UpdateCustomerStatusSchema>;

// Query params for customer transactions
export const CustomerTransactionsQuerySchema = z.object({
  transactionType: z.enum(['CUSTOMER_PAYMENT', 'REFUND', 'PLATFORM_COMMISSION', 'OPERATOR_PAYOUT']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CustomerTransactionsQueryDto = z.infer<typeof CustomerTransactionsQuerySchema>;

export const AddNoteSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type AddNoteDto = z.infer<typeof AddNoteSchema>;

export const EditNoteSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type EditNoteDto = z.infer<typeof EditNoteSchema>;

