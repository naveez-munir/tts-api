import { z } from 'zod';
import { VehicleTypeSchema } from '../../../common/enums/index.js';

export const CreateVehicleSchema = z.object({
  vehicleType: VehicleTypeSchema,
  registrationPlate: z.string().min(1, 'Registration plate is required'),
  make: z.string().min(1, 'Vehicle make is required'),
  model: z.string().min(1, 'Vehicle model is required'),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
});

export const UpdateVehicleSchema = z.object({
  vehicleType: VehicleTypeSchema.optional(),
  registrationPlate: z.string().min(1).optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  isActive: z.boolean().optional(),
});

export type CreateVehicleDto = z.infer<typeof CreateVehicleSchema>;
export type UpdateVehicleDto = z.infer<typeof UpdateVehicleSchema>;
