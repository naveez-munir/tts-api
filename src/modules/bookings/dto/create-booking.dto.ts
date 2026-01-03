import { z } from 'zod';

// Base journey schema (shared between outbound and return)
const JourneySchema = z.object({
  pickupAddress: z.string().min(1, 'Pickup address is required'),
  pickupPostcode: z.string().optional(), // Optional - not all addresses have postcodes
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropoffAddress: z.string().min(1, 'Dropoff address is required'),
  dropoffPostcode: z.string().optional(), // Optional - not all addresses have postcodes
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  pickupDatetime: z.string().datetime('Invalid datetime format'),
  passengerCount: z.number().min(1).max(16),
  luggageCount: z.number().min(0),
  vehicleType: z.enum(['SALOON', 'ESTATE', 'MPV', 'EXECUTIVE', 'MINIBUS']),
  serviceType: z.enum(['AIRPORT_PICKUP', 'AIRPORT_DROPOFF', 'POINT_TO_POINT']),
  flightNumber: z.string().optional(),
  specialRequirements: z.string().optional(),
  // Lead passenger contact details (may differ from booking user)
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  // Price for this leg (calculated from quote)
  customerPrice: z.number().positive('Price must be positive'),
});

// One-way booking schema
export const CreateBookingSchema = JourneySchema.extend({
  isReturnJourney: z.literal(false).optional().default(false),
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;

// Return journey booking schema (includes both legs)
export const CreateReturnBookingSchema = z.object({
  isReturnJourney: z.literal(true),

  // Outbound journey details
  outbound: JourneySchema,

  // Return journey details (pickup/dropoff swapped)
  returnJourney: JourneySchema,

  // Total price for both journeys (with discount applied)
  totalPrice: z.number().positive('Total price must be positive'),

  // Discount amount (5% for return journey)
  discountAmount: z.number().min(0).optional(),
});

export type CreateReturnBookingDto = z.infer<typeof CreateReturnBookingSchema>;

// Combined schema that accepts either one-way or return booking
export const CreateBookingRequestSchema = z.discriminatedUnion('isReturnJourney', [
  CreateBookingSchema.extend({ isReturnJourney: z.literal(false) }),
  CreateReturnBookingSchema,
]);

export type CreateBookingRequestDto = z.infer<typeof CreateBookingRequestSchema>;

