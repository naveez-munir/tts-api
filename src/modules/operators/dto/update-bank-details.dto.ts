import { z } from 'zod';

export const UpdateBankDetailsSchema = z.object({
  bankAccountName: z.string().min(1, 'Bank account name is required'),
  bankAccountNumber: z.string().min(8, 'Bank account number must be at least 8 digits').max(8, 'Bank account number must be 8 digits'),
  bankSortCode: z.string().regex(/^\d{6}$/, 'Sort code must be 6 digits'),
});

export type UpdateBankDetailsDto = z.infer<typeof UpdateBankDetailsSchema>;

