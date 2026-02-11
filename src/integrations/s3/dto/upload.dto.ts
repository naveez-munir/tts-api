import { z } from 'zod';

export const GenerateUploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255),
  fileType: z.enum(['pdf', 'jpg', 'jpeg', 'png'], {
    message: 'File type must be pdf, jpg, jpeg, or png',
  }),
  documentType: z.enum(['license', 'insurance', 'company_registration', 'other'], {
    message: 'Document type must be license, insurance, company_registration, or other',
  }),
});

export type GenerateUploadUrlDto = z.infer<typeof GenerateUploadUrlSchema>;

export const ConfirmUploadSchema = z.object({
  key: z.string().min(1, 'S3 key is required'),
  documentType: z.enum(['license', 'insurance', 'company_registration', 'other']),
  originalFileName: z.string().min(1, 'Original file name is required'),
  expiresAt: z
    .string()
    .datetime({ message: 'Expiry date must be a valid ISO date' })
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        return new Date(val) > new Date();
      },
      { message: 'Expiry date must be in the future' },
    ),
});

export type ConfirmUploadDto = z.infer<typeof ConfirmUploadSchema>;

export const GetDownloadUrlSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
});

export type GetDownloadUrlDto = z.infer<typeof GetDownloadUrlSchema>;

