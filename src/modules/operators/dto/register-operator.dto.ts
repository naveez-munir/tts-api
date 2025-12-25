import { z } from 'zod';

export const RegisterOperatorSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  vatNumber: z.string().optional(),
  serviceAreas: z.array(z.string()).min(1, 'At least one service area required'),
  vehicleTypes: z.array(z.enum(['SALOON', 'ESTATE', 'MPV', 'EXECUTIVE', 'MINIBUS'])),
});

export type RegisterOperatorDto = z.infer<typeof RegisterOperatorSchema>;

