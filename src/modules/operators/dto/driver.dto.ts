import { z } from 'zod';

export const CreateDriverSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  profileImageUrl: z.string().url().optional(),
  dateOfBirth: z.string().datetime().optional(),
  drivingLicenseNumber: z.string().optional(),
  phvLicenseNumber: z.string().optional(),
  phvLicenseExpiry: z.string().datetime().optional(),
  issuingCouncil: z.string().optional(),
  badgeNumber: z.string().optional(),
  nationalInsuranceNo: z.string().optional(),
});

export const UpdateDriverSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(1).optional(),
  profileImageUrl: z.string().url().optional(),
  dateOfBirth: z.string().datetime().optional(),
  drivingLicenseNumber: z.string().optional(),
  phvLicenseNumber: z.string().optional(),
  phvLicenseExpiry: z.string().datetime().optional(),
  issuingCouncil: z.string().optional(),
  badgeNumber: z.string().optional(),
  nationalInsuranceNo: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateDriverDto = z.infer<typeof CreateDriverSchema>;
export type UpdateDriverDto = z.infer<typeof UpdateDriverSchema>;

