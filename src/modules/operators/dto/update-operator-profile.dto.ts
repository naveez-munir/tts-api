import { z } from 'zod';
import { VehicleTypeSchema } from '../../../common/enums/index.js';

export const UpdateOperatorProfileSchema = z.object({
  companyName: z.string().min(1).optional(),
  vatNumber: z.string().optional(),
  operatingLicenseNumber: z.string().optional(),
  councilRegistration: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPostcode: z.string().optional(),
  fleetSize: z.number().int().positive().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  vehicleTypes: z.array(VehicleTypeSchema).optional(),
});

export type UpdateOperatorProfileDto = z.infer<typeof UpdateOperatorProfileSchema>;

