import { z } from 'zod';
import { VehicleTypeSchema } from '../../../common/enums/index.js';

export const CreatePricingRuleSchema = z.object({
  ruleType: z.enum([
    'BASE_FARE',
    'PER_MILE_RATE',
    'NIGHT_SURCHARGE',
    'PEAK_SURCHARGE',
    'HOLIDAY_SURCHARGE',
    'MEET_AND_GREET',
    'RETURN_DISCOUNT',
    'CHILD_SEAT',
    'BOOSTER_SEAT',
    'AIRPORT_FEE',
  ]),
  vehicleType: VehicleTypeSchema.optional(),
  baseValue: z.number().positive(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type CreatePricingRuleDto = z.infer<typeof CreatePricingRuleSchema>;

export const UpdatePricingRuleSchema = CreatePricingRuleSchema.partial();

export type UpdatePricingRuleDto = z.infer<typeof UpdatePricingRuleSchema>;

