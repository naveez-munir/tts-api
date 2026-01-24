import { z } from 'zod';

// Response DTO for vehicle capacity
export interface VehicleCapacityResponse {
  id: string;
  vehicleType: string;
  maxPassengers: number;
  maxPassengersHandOnly: number | null;
  maxSuitcases: number;
  maxHandLuggage: number;
  rateReductionPer100Miles: number | null; // Rate reduction per 100 miles (e.g., 0.30 = 30p)
  exampleModels: string;
  description: string | null;
  isActive: boolean;
}

// Update DTO schema (for admin)
export const UpdateVehicleCapacitySchema = z.object({
  maxPassengers: z.number().int().min(1).max(20).optional(),
  maxPassengersHandOnly: z.number().int().min(1).max(20).nullable().optional(),
  maxSuitcases: z.number().int().min(0).max(20).optional(),
  maxHandLuggage: z.number().int().min(0).max(20).optional(),
  rateReductionPer100Miles: z.number().min(0).max(5).nullable().optional(), // 0 to £5 reduction
  exampleModels: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateVehicleCapacityDto = z.infer<typeof UpdateVehicleCapacitySchema>;

