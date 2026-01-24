# Booking & Payment Flow Summary

## One-Way Booking Flow

### Step 1: Create Booking
```
POST /api/bookings
Authorization: Bearer <token>
```
```json
{
  "pickupAddress": "Manchester Square, London, UK",
  "pickupPostcode": "W1U",
  "pickupLat": 51.5167,
  "pickupLng": -0.1522,
  "dropoffAddress": "Heathrow Airport, London, UK",
  "dropoffPostcode": "TW6",
  "dropoffLat": 51.4700,
  "dropoffLng": -0.4543,
  "pickupDatetime": "2026-01-29T05:00:00.000Z",
  "passengerCount": 2,
  "luggageCount": 2,
  "vehicleType": "SALOON",
  "serviceType": "AIRPORT_DROPOFF",
  "customerPrice": 58.04
}
```

### Step 2: Create Payment Intent
```
POST /api/payments/intent
Authorization: Bearer <token>
```
```json
{
  "bookingId": "cmkfnw6x8000m1r1qwmuoudyc",
  "amount": "58.04"
}
```

### Step 3: Stripe Handles Payment
Frontend uses `clientSecret` from response with Stripe.js

### Step 4: Webhook Confirms Payment
Stripe webhook (`payment_intent.succeeded`) auto-updates booking to PAID

---

## Return Journey Booking Flow

### Step 1: Create Return Booking
```
POST /api/bookings/return
Authorization: Bearer <token>
```
```json
{
  "isReturnJourney": true,
  "outbound": {
    "pickupAddress": "Manchester Square, London, UK",
    "pickupPostcode": "W1U",
    "pickupLat": 51.5167,
    "pickupLng": -0.1522,
    "dropoffAddress": "Heathrow Airport, London, UK",
    "dropoffPostcode": "TW6",
    "dropoffLat": 51.4700,
    "dropoffLng": -0.4543,
    "pickupDatetime": "2026-01-29T05:00:00.000Z",
    "passengerCount": 2,
    "luggageCount": 2,
    "vehicleType": "SALOON",
    "serviceType": "AIRPORT_DROPOFF",
    "customerPrice": 55.00
  },
  "returnJourney": {
    "pickupAddress": "Heathrow Airport, London, UK",
    "pickupPostcode": "TW6",
    "pickupLat": 51.4700,
    "pickupLng": -0.4543,
    "dropoffAddress": "Manchester Square, London, UK",
    "dropoffPostcode": "W1U",
    "dropoffLat": 51.5167,
    "dropoffLng": -0.1522,
    "pickupDatetime": "2026-01-31T18:00:00.000Z",
    "passengerCount": 2,
    "luggageCount": 2,
    "vehicleType": "SALOON",
    "serviceType": "AIRPORT_PICKUP",
    "customerPrice": 55.00
  },
  "totalPrice": 104.50,
  "discountAmount": 5.50
}
```

### Step 2: Create Group Payment Intent
```
POST /api/payments/group/create-intent
Authorization: Bearer <token>
```
```json
{
  "bookingGroupId": "cmkgxyz123...",
  "amount": "104.50"
}
```

### Step 3: Stripe Handles Payment
Frontend uses `clientSecret` from response with Stripe.js

### Step 4: Webhook Confirms Payment
Stripe webhook auto-updates BOTH bookings to PAID

---

## Frontend: Auto-Swap for Return Journey

When user selects "Return Journey", swap pickup ↔ dropoff:

```typescript
// User's original selection (outbound)
const outbound = {
  pickup: { address: "Home", lat: 51.51, lng: -0.15 },
  dropoff: { address: "Airport", lat: 51.47, lng: -0.45 },
  datetime: "2026-01-29T05:00:00.000Z",
  serviceType: "AIRPORT_DROPOFF"
};

// Auto-generate return journey (SWAP locations)
const returnJourney = {
  pickup: outbound.dropoff,      // Airport → now pickup
  dropoff: outbound.pickup,      // Home → now dropoff
  datetime: returnDatetime,      // User selects return date/time
  serviceType: "AIRPORT_PICKUP"  // Flip service type
};
```

### Service Type Mapping
| Outbound Service | Return Service |
|------------------|----------------|
| `AIRPORT_DROPOFF` | `AIRPORT_PICKUP` |
| `AIRPORT_PICKUP` | `AIRPORT_DROPOFF` |
| `POINT_TO_POINT` | `POINT_TO_POINT` |

### Discount Calculation
```typescript
const outboundPrice = 55.00;
const returnPrice = 55.00;
const combinedTotal = outboundPrice + returnPrice; // 110.00
const discountPercent = 5;
const discountAmount = combinedTotal * (discountPercent / 100); // 5.50
const totalPrice = combinedTotal - discountAmount; // 104.50
```

---

## All Payment Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payments/intent` | POST | Create payment intent (one-way) |
| `/api/payments/confirm` | POST | Confirm payment (one-way) |
| `/api/payments/group/create-intent` | POST | Create payment intent (return journey) |
| `/api/payments/group/confirm` | POST | Confirm payment (return journey) |
| `/api/payments/history/:bookingId` | GET | Get transaction history |
| `/api/payments/group/:groupId/transactions` | GET | Get group transaction history |
| `/api/payments/refund/:bookingId` | POST | Process refund |

