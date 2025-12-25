# 🚀 QUICK START GUIDE

## Current Status
✅ **Phase 1-3 Complete**: All core modules implemented
✅ **Phase 4 Complete**: All API integrations implemented
✅ **Phase 5 Complete**: Admin module implemented
✅ **Return Journey Architecture**: Linked bookings with BookingGroup
✅ **44 API Endpoints**: Ready to use
✅ **Database**: PostgreSQL with seed data (15 models)
✅ **Build**: 0 errors

### Integrations Ready
- ✅ **Google Maps API** - Distance calculation, address autocomplete, quote engine
- ✅ **Stripe** - Payment processing, webhooks, refunds, group payments
- ✅ **SendGrid** - Email notifications (booking confirmation, driver assigned, job alerts)
- ✅ **Twilio** - SMS notifications (booking confirmation, urgent job alerts)

### Admin Module Ready
- ✅ **Dashboard** - KPIs, recent activity, alerts
- ✅ **Operator Management** - List, approve, reject, suspend operators
- ✅ **Booking Management** - List with filters, process refunds
- ✅ **Booking Group Management** - Manage return journeys
- ✅ **Job Management** - Manual job assignment
- ✅ **Pricing Rules** - Full CRUD operations
- ✅ **Reports** - Revenue and payouts reports

### Return Journey Architecture ✅
- **BookingGroup** - Links outbound + return bookings together
- **JourneyType** - ONE_WAY, OUTBOUND, RETURN
- **5% Discount** - Automatically applied for return journeys
- **Independent Jobs** - Separate bidding window per leg
- **Group Payments** - Single payment for both journeys

---

## Running the Application

### Start Development Server
```bash
npm run start:dev
```
Server runs on `http://localhost:4000`

### Build for Production
```bash
npm run build
```

### Run Production Build
```bash
npm run start:prod
```

---

## Database Commands

### View Database (Prisma Studio)
```bash
npm run db:studio
```
Opens `http://localhost:5555`

### Seed Database
```bash
npm run db:seed
```

### Create Migration
```bash
npx prisma migrate dev --name <migration_name>
```

---

## Testing Endpoints

### 1. Register User
```bash
POST http://localhost:4000/auth/register
{
  "email": "test@example.com",
  "password": "Test@123456",
  "firstName": "John",
  "lastName": "Doe",
  "role": "CUSTOMER"
}
```

### 2. Login
```bash
POST http://localhost:4000/auth/login
{
  "email": "test@example.com",
  "password": "Test@123456"
}
```

### 3. Create One-Way Booking (with JWT token)
```bash
POST http://localhost:4000/api/bookings
Authorization: Bearer <token>
{
  "pickupAddress": "123 Main St",
  "pickupPostcode": "SW1A",
  "pickupLat": 51.5074,
  "pickupLng": -0.1278,
  "dropoffAddress": "456 Park Ave",
  "dropoffPostcode": "SW1B",
  "dropoffLat": 51.5174,
  "dropoffLng": -0.1378,
  "pickupDatetime": "2025-12-20T10:00:00Z",
  "passengerCount": 2,
  "luggageCount": 2,
  "vehicleType": "SALOON",
  "serviceType": "AIRPORT_PICKUP"
}
```

### 4. Create Return Journey Booking
```bash
POST http://localhost:4000/api/bookings/return
Authorization: Bearer <token>
{
  "outbound": {
    "pickupAddress": "123 Main St, London",
    "pickupPostcode": "SW1A 1AA",
    "pickupLat": 51.5074,
    "pickupLng": -0.1278,
    "dropoffAddress": "Heathrow Airport T5",
    "dropoffPostcode": "TW6 2GA",
    "dropoffLat": 51.4700,
    "dropoffLng": -0.4543,
    "pickupDatetime": "2025-12-20T08:00:00Z",
    "passengerCount": 2,
    "luggageCount": 2,
    "vehicleType": "SALOON",
    "serviceType": "AIRPORT_DROPOFF"
  },
  "returnJourney": {
    "pickupDatetime": "2025-12-27T18:00:00Z",
    "flightNumber": "BA123"
  }
}
```

---

## Project Structure

```
src/
├── auth/              # Authentication
├── users/             # User management
├── modules/
│   ├── bookings/      # Booking management
│   ├── jobs/          # Job management
│   ├── bids/          # Bidding system
│   ├── operators/     # Operator portal
│   └── payments/      # Payment processing
├── integrations/
│   ├── google-maps/   # Maps, distance, quotes
│   ├── stripe/        # Payment processing
│   ├── sendgrid/      # Email notifications
│   ├── twilio/        # SMS notifications
│   └── notifications/ # Unified notification service
├── common/            # Shared utilities
└── database/          # Prisma service
```

---

## Environment Variables

See `.env` file for configuration:
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing key
- `JWT_EXPIRES_IN` - Token expiration
- `PORT` - Server port (default: 4000)
- `GOOGLE_MAPS_API_KEY` - Google Maps API
- `STRIPE_SECRET_KEY` - Stripe payments
- `STRIPE_WEBHOOK_SECRET` - Stripe webhooks
- `SENDGRID_API_KEY` - SendGrid email
- `TWILIO_ACCOUNT_SID` - Twilio SMS
- `TWILIO_AUTH_TOKEN` - Twilio SMS
- `TWILIO_PHONE_NUMBER` - Twilio sender

---

## Next Steps

### Phase 6: Testing & Deployment
1. Unit tests for services
2. Integration tests for API endpoints
3. E2E tests for critical flows
4. Security audit
5. Deployment to production

---

## Useful Commands

```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm run test

# Watch tests
npm run test:watch

# Test coverage
npm run test:cov
```

---

**Phase 5 Complete! Admin module + Return Journey Architecture implemented. Ready for Testing & Deployment.** 🚀

