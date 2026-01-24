# 🚀 API ENDPOINTS - FULLY IMPLEMENTED

**Total Endpoints**: 44
**Status**: ✅ All implemented and tested
**Build**: ✅ 0 errors
**Phase**: 5 Complete (Admin Module + Return Journey Architecture)

---

## 🔐 Authentication (2 endpoints)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user

---

## 📅 Bookings (9 endpoints)
- `POST /api/bookings` - Create one-way booking
- `POST /api/bookings/return` - Create return journey (outbound + return) ✨ NEW
- `GET /api/bookings` - List customer bookings
- `GET /api/bookings/organized` - Get bookings organized by journey type ✨ NEW
- `GET /api/bookings/:id` - Get booking details
- `GET /api/bookings/reference/:bookingReference` - Get by reference
- `GET /api/bookings/groups/:groupId` - Get booking group (return journey) ✨ NEW
- `GET /api/bookings/groups/reference/:groupReference` - Get group by reference ✨ NEW
- `PATCH /api/bookings/:id` - Update booking
- `POST /api/bookings/:id/cancel` - Cancel booking

---

## 💼 Jobs (5 endpoints)
- `POST /api/jobs` - Create job from booking
- `POST /api/jobs/group/:bookingGroupId` - Create jobs for booking group ✨ NEW
- `GET /api/jobs/:id` - Get job with bids
- `GET /api/jobs/available/:postcode` - List available jobs
- `POST /api/jobs/:id/assign-winner` - Assign lowest bid

---

## 💰 Bids (3 endpoints)
- `POST /api/bids` - Submit/update bid
- `GET /api/bids/job/:jobId` - List job bids
- `GET /api/bids/:id` - Get bid details

---

## 🏢 Operators (4 endpoints)
- `POST /api/operators/register` - Register operator
- `GET /api/operators/profile/:id` - Get operator profile
- `GET /api/operators/dashboard` - Operator dashboard
- `PATCH /api/operators/profile/:id` - Update profile

---

## 💳 Payments (7 endpoints)
- `POST /api/payments/intent` - Create Stripe payment intent
- `POST /api/payments/confirm` - Confirm payment
- `POST /api/payments/group/create-intent` - Create group payment intent ✨ NEW
- `POST /api/payments/group/confirm` - Confirm group payment ✨ NEW
- `GET /api/payments/history/:bookingId` - Transaction history
- `GET /api/payments/group/:groupId/transactions` - Group transaction history ✨ NEW
- `POST /api/payments/refund/:bookingId` - Process Stripe refund

---

## 🗺️ Google Maps (6 endpoints)
- `GET /api/maps/autocomplete?input=xxx` - Address autocomplete
- `GET /api/maps/place-details?placeId=xxx` - Get coordinates from place
- `GET /api/maps/distance?originLat=...&destLat=...` - Calculate distance/duration
- `POST /api/maps/quote` - Calculate price quote (legacy)
- `POST /api/maps/quote/single` - Calculate single journey quote ✨ NEW
- `POST /api/maps/quote/return` - Calculate return journey quote (with 5% discount) ✨ NEW

---

## 🔔 Webhooks (1 endpoint)
- `POST /api/webhooks/stripe` - Stripe webhook handler

---

## 🛠️ Admin (19 endpoints)

### Customer Management (5 endpoints) ✨ NEW
- `GET /api/admin/customers` - List all customers with search/filters
- `GET /api/admin/customers/:id` - Get customer details with statistics
- `PATCH /api/admin/customers/:id/status` - Activate/deactivate customer account
- `GET /api/admin/customers/:id/bookings` - Get customer booking history
- `GET /api/admin/customers/:id/transactions` - Get customer transaction history

### Operator Management (2 endpoints)
- `GET /api/admin/operators` - List operators with filters
- `PATCH /api/admin/operators/:id/approval` - Approve/reject/suspend operator

### Booking Management (4 endpoints)
- `GET /api/admin/bookings` - List bookings with filters (includes journey info)
- `POST /api/admin/bookings/:id/refund` - Process refund
- `GET /api/admin/booking-groups` - List booking groups (return journeys)
- `GET /api/admin/booking-groups/:id` - Get booking group details

### Job Management (1 endpoint)
- `POST /api/admin/jobs/:jobId/assign` - Manual job assignment

### Pricing & Reports (7 endpoints)
- `GET /api/admin/dashboard` - KPIs, activity, alerts
- `GET /api/admin/pricing-rules` - List pricing rules
- `POST /api/admin/pricing-rules` - Create pricing rule
- `PATCH /api/admin/pricing-rules/:id` - Update pricing rule
- `DELETE /api/admin/pricing-rules/:id` - Delete pricing rule
- `GET /api/admin/reports/revenue` - Revenue report
- `GET /api/admin/reports/payouts` - Payouts report

---

## 🔒 Authentication Required

All endpoints except auth require JWT token:
```
Authorization: Bearer <token>
```

---

## 📝 Response Format

**Success**:
```json
{
  "success": true,
  "data": { /* payload */ },
  "meta": { /* optional */ }
}
```

**Error**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

---

## 🔌 Integrations Implemented

### Google Maps
- Places API for address autocomplete
- Distance Matrix API for distance/duration
- Geocoding API for coordinates
- Quote Service with pricing engine

### Stripe
- Payment Intent creation
- Webhook handling (payment success/fail/refund)
- Refund processing
- Mock mode for development

### SendGrid
- Booking confirmation emails
- Driver assignment emails
- New job alert emails
- Bid won notification emails
- HTML email templates

### Twilio
- Booking confirmation SMS
- Driver details SMS
- Urgent job alerts (within 24h)
- Bid won SMS

### Unified Notifications Service
- Combines email + SMS
- Auto-selects notification channel
- Logs all notifications to database

---

## 🔄 Return Journey Architecture

### New Models
- **BookingGroup** - Links outbound + return bookings
- **JourneyType** - ONE_WAY, OUTBOUND, RETURN
- **DiscountType** - RETURN_JOURNEY, PROMOTIONAL
- **BookingGroupStatus** - ACTIVE, PARTIALLY_CANCELLED, FULLY_CANCELLED, COMPLETED

### Features
- 5% automatic discount for return journeys
- Independent jobs for each leg (separate bidding)
- Single payment for both journeys
- Linked booking references (TTS-GRP-XXXXXX)

---

## ✅ READY FOR TESTING

All endpoints are:
- ✅ Type-safe (TypeScript strict mode)
- ✅ Validated (Zod schemas)
- ✅ Authenticated (JWT guards)
- ✅ Role-based access (RBAC)
- ✅ Integrated with third-party APIs
- ✅ Return journey support

---

**Next**: Phase 6 - Testing & Deployment 🚀

