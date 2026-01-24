import { z } from 'zod';

// Update single setting
export const UpdateSystemSettingSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.any())]),
});

export type UpdateSystemSettingDto = z.infer<typeof UpdateSystemSettingSchema>;

// Bulk update settings
export const BulkUpdateSettingsSchema = z.object({
  updates: z.array(
    z.object({
      key: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.any())]),
    }),
  ),
});

export type BulkUpdateSettingsDto = z.infer<typeof BulkUpdateSettingsSchema>;

