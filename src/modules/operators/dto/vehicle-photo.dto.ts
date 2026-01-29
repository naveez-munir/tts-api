import { z } from 'zod';

export const VehiclePhotoTypeSchema = z.enum([
  'FRONT',
  'BACK',
  'DRIVER_SIDE',
  'FRONT_SIDE',
  'DASHBOARD',
  'REAR_BOOT',
]);

export const VehiclePhotoSchema = z.object({
  photoType: VehiclePhotoTypeSchema,
  photoUrl: z.string().min(1, 'Photo URL is required'),
});

export const UpdateVehiclePhotosSchema = z.object({
  photos: z.array(VehiclePhotoSchema),
});

export type VehiclePhotoType = z.infer<typeof VehiclePhotoTypeSchema>;
export type VehiclePhotoDto = z.infer<typeof VehiclePhotoSchema>;
export type UpdateVehiclePhotosDto = z.infer<typeof UpdateVehiclePhotosSchema>;

