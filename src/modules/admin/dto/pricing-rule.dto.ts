import { z } from 'zod';

export const CreatePricingRuleSchema = z.object({
  ruleType: z.enum(['BASE_FARE', 'PER_MILE', 'TIME_SURCHARGE', 'HOLIDAY_SURCHARGE', 'AIRPORT_FEE']),
  vehicleType: z.enum(['SALOON', 'ESTATE', 'MPV', 'EXECUTIVE', 'MINIBUS']).optional(),
  baseValue: z.number().positive(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type CreatePricingRuleDto = z.infer<typeof CreatePricingRuleSchema>;

export const UpdatePricingRuleSchema = CreatePricingRuleSchema.partial();

export type UpdatePricingRuleDto = z.infer<typeof UpdatePricingRuleSchema>;

