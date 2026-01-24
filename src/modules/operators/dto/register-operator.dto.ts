import { z } from 'zod';
import { VehicleTypeSchema } from '../../../common/enums/index.js';

export const RegisterOperatorSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  vatNumber: z.string().optional(),
  serviceAreas: z.array(z.string()).min(1, 'At least one service area required'),
  vehicleTypes: z.array(VehicleTypeSchema).min(1, 'At least one vehicle type required'),
  // Operator compliance fields (per data.md requirements)
  operatingLicenseNumber: z.string().optional(),
  councilRegistration: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPostcode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  fleetSize: z.number().int().positive().optional(),
});

export type RegisterOperatorDto = z.infer<typeof RegisterOperatorSchema>;

