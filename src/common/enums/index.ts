/**
 * Shared Enums - Single Source of Truth
 *
 * Re-export Prisma enums and create Zod-compatible versions.
 * This ensures consistency across all validation schemas.
 */

import { z } from 'zod';
import {
  VehicleType,
  ServiceType,
  UserRole,
  BookingStatus,
  JobStatus,
  BidStatus,
  OperatorApprovalStatus,
  NotificationType,
  NotificationStatus,
  TransactionStatus,
  PayoutStatus,
} from '@prisma/client';

// Re-export Prisma enums for use across the application
export {
  VehicleType,
  ServiceType,
  UserRole,
  BookingStatus,
  JobStatus,
  BidStatus,
  OperatorApprovalStatus,
  NotificationType,
  NotificationStatus,
  TransactionStatus,
  PayoutStatus,
};

// ============================================================================
// ZOD ENUM SCHEMAS - Derived from Prisma enums (single source of truth)
// Using z.nativeEnum() to preserve Prisma enum types
// ============================================================================

export const VehicleTypeSchema = z.nativeEnum(VehicleType);
export const ServiceTypeSchema = z.nativeEnum(ServiceType);
export const UserRoleSchema = z.nativeEnum(UserRole);
export const BookingStatusSchema = z.nativeEnum(BookingStatus);
export const JobStatusSchema = z.nativeEnum(JobStatus);
export const BidStatusSchema = z.nativeEnum(BidStatus);
export const OperatorApprovalStatusSchema = z.nativeEnum(OperatorApprovalStatus);
export const NotificationTypeSchema = z.nativeEnum(NotificationType);
export const NotificationStatusSchema = z.nativeEnum(NotificationStatus);
export const TransactionStatusSchema = z.nativeEnum(TransactionStatus);
export const PayoutStatusSchema = z.nativeEnum(PayoutStatus);

// ============================================================================
// ENUM VALUE ARRAYS - For iteration/mapping
// ============================================================================

export const VEHICLE_TYPES = Object.values(VehicleType);
export const SERVICE_TYPES = Object.values(ServiceType);
export const USER_ROLES = Object.values(UserRole);
export const BOOKING_STATUSES = Object.values(BookingStatus);
export const JOB_STATUSES = Object.values(JobStatus);
export const BID_STATUSES = Object.values(BidStatus);

