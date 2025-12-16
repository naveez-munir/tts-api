import { z } from 'zod';

// Single booking response
export const BookingResponseSchema = z.object({
  id: z.string(),
  bookingReference: z.string(),
  journeyType: z.enum(['ONE_WAY', 'OUTBOUND', 'RETURN']),
  status: z.string(),
  pickupAddress: z.string(),
  pickupPostcode: z.string(),
  dropoffAddress: z.string(),
  dropoffPostcode: z.string(),
  pickupDatetime: z.string(),
  passengerCount: z.number(),
  luggageCount: z.number(),
  vehicleType: z.string(),
  serviceType: z.string(),
  flightNumber: z.string().nullable(),
  specialRequirements: z.string().nullable(),
  customerPrice: z.number(),
  linkedBookingId: z.string().nullable(),
  bookingGroupId: z.string().nullable(),
  createdAt: z.string(),
});

export type BookingResponse = z.infer<typeof BookingResponseSchema>;

// Booking group response (for return journeys)
export const BookingGroupResponseSchema = z.object({
  id: z.string(),
  groupReference: z.string(),
  status: z.string(),
  totalPrice: z.number(),
  discountType: z.string().nullable(),
  discountAmount: z.number().nullable(),
  createdAt: z.string(),
  bookings: z.array(BookingResponseSchema),
});

export type BookingGroupResponse = z.infer<typeof BookingGroupResponseSchema>;

// Response for creating a booking (one-way or return)
export const CreateBookingResponseSchema = z.discriminatedUnion('isReturnJourney', [
  z.object({
    isReturnJourney: z.literal(false),
    booking: BookingResponseSchema,
  }),
  z.object({
    isReturnJourney: z.literal(true),
    bookingGroup: BookingGroupResponseSchema,
  }),
]);

export type CreateBookingResponse = z.infer<typeof CreateBookingResponseSchema>;

// Customer bookings list response (groups return journeys together)
export const CustomerBookingsResponseSchema = z.object({
  oneWayBookings: z.array(BookingResponseSchema),
  returnJourneys: z.array(BookingGroupResponseSchema),
});

export type CustomerBookingsResponse = z.infer<typeof CustomerBookingsResponseSchema>;

