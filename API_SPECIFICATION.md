# API SPECIFICATION DOCUMENTATION

**Version:** 1.0
**Last Updated:** December 2025
**Base URL (Development):** `http://localhost:4000/api`
**Base URL (Production):** `https://api.yourdomain.com/api`

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Response Format](#api-response-format)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Endpoints by Module](#endpoints-by-module)
   - [Authentication](#authentication-endpoints)
   - [Bookings](#bookings-endpoints)
   - [Jobs](#jobs-endpoints)
   - [Bids](#bids-endpoints)
   - [Operators](#operators-endpoints)
   - [Payments](#payments-endpoints)
   - [Admin](#admin-endpoints)
7. [Webhooks](#webhooks)
8. [Zod Schemas](#zod-schemas)

---

## 1. OVERVIEW

### API Design Principles

- **RESTful**: Resource-based URLs with standard HTTP methods
- **JSON**: All requests and responses use JSON format
- **Stateless**: JWT-based authentication (no server-side sessions)
- **Versioned**: API version in URL path (e.g., `/api/v1/bookings`) - optional for MVP
- **Consistent**: Standard response format for all endpoints
- **Secure**: HTTPS only in production, input validation, rate limiting

### HTTP Methods

- **GET**: Retrieve resources (idempotent, cacheable)
- **POST**: Create new resources
- **PATCH**: Partial update of resources
- **PUT**: Full replacement of resources (rarely used)
- **DELETE**: Remove resources

### Content Type

- **Request**: `Content-Type: application/json`
- **Response**: `Content-Type: application/json`

---

## 2. AUTHENTICATION

### JWT-Based Authentication

**Access Token**:
- Stored in httpOnly cookie (frontend) or Authorization header
- Expires in 7 days (configurable)
- Contains: user ID, email, role

**Refresh Token** (optional for MVP):
- Stored in httpOnly cookie
- Expires in 30 days
- Used to obtain new access token

### Authorization Header

```
Authorization: Bearer <access_token>
```

### Protected Routes

All endpoints except the following require authentication:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /health`

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **CUSTOMER** | Create bookings, view own bookings, make payments |
| **OPERATOR** | View jobs, submit bids, manage assigned jobs, view earnings |
| **ADMIN** | Full access to all endpoints, operator approval, pricing configuration |

---

## 3. API RESPONSE FORMAT

### Success Response

```typescript
{
  success: true,
  data: {
    // Response payload (object or array)
  },
  meta?: {
    // Optional metadata (pagination, timestamps, etc.)
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  }
}
```

**Example**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "booking_reference": "BK123456",
    "status": "PAID",
    "quoted_price": 45.50
  },
  "meta": {
    "timestamp": "2025-12-10T10:30:00Z"
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    code: string;        // Machine-readable error code
    message: string;     // Human-readable error message
    details?: any[];     // Optional array of validation errors
  }
}
```

**Example**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid booking details",


### AUTHENTICATION ENDPOINTS

#### POST /auth/register

**Description**: Register a new user (customer or operator).

**Authentication**: None (public endpoint)

**Request Body**:
```typescript
{
  email: string;           // Valid email format
  password: string;        // Min 8 characters, 1 uppercase, 1 lowercase, 1 number
  first_name: string;
  last_name: string;
  phone_number: string;
  role: 'CUSTOMER' | 'OPERATOR';

  // If role is OPERATOR, include:
  company_name?: string;
  registration_number?: string;
  vat_number?: string;
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    user: {
      id: string;
      email: string;
      role: string;
      first_name: string;
      last_name: string;
    },
    access_token: string;
  }
}
```

**Errors**:
- 400: Validation error (invalid email, weak password)
- 409: Email already exists

---

#### POST /auth/login

**Description**: Login with email and password.

**Authentication**: None (public endpoint)

**Request Body**:
```typescript
{
  email: string;
  password: string;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    user: {
      id: string;
      email: string;
      role: string;
      first_name: string;
      last_name: string;
    },
    access_token: string;
  }
}
```

**Errors**:
- 400: Validation error
- 401: Invalid credentials
- 403: Account not active

---

#### POST /auth/logout

**Description**: Logout (invalidate token).

**Authentication**: Required

**Request Body**: None

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    message: "Logged out successfully"
  }
}
```

---

#### GET /auth/me

**Description**: Get current authenticated user details.

**Authentication**: Required

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    is_email_verified: boolean;
    operator_profile?: {
      id: string;
      company_name: string;
      approval_status: string;
      reputation_score: number;
    }
  }
}
```

---

#### POST /auth/forgot-password

**Description**: Request password reset email.

**Authentication**: None (public endpoint)

**Request Body**:
```typescript
{
  email: string;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    message: "Password reset email sent"
  }
}
```

**Note**: Always returns 200 even if email doesn't exist (security best practice).

---

#### POST /auth/reset-password

**Description**: Reset password with token from email.

**Authentication**: None (public endpoint)

**Request Body**:
```typescript
{
  token: string;        // Token from email link
  new_password: string; // Min 8 characters, 1 uppercase, 1 lowercase, 1 number
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    message: "Password reset successfully"
  }
}
```

**Errors**:
- 400: Invalid or expired token
- 400: Weak password

---

### BOOKINGS ENDPOINTS

#### POST /bookings/quote

**Description**: Calculate quote for a journey (no authentication required for initial quote).

**Authentication**: Optional (can be called before login)

**Request Body**:
```typescript
{
  service_type: 'AIRPORT_PICKUP' | 'AIRPORT_DROPOFF' | 'POINT_TO_POINT';
  pickup_location: {
    address: string;
    postcode: string;
    lat: number;
    lng: number;
  };
  dropoff_location: {
    address: string;
    postcode: string;
    lat: number;
    lng: number;
  };
  pickup_datetime: string;      // ISO 8601 format
  passenger_count: number;      // 1-16
  luggage_count: number;        // 0+
  vehicle_type: 'SALOON' | 'ESTATE' | 'MPV' | 'EXECUTIVE' | 'MINIBUS';
  has_meet_and_greet?: boolean;
  is_return_journey?: boolean;
  via_points?: Array<{
    address: string;
    postcode: string;
    lat: number;
    lng: number;
  }>;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    distance_miles: number;
    duration_minutes: number;
    base_fare: number;
    distance_charge: number;
    surcharges: Array<{
      type: string;
      description: string;
      amount: number;
    }>;
    discounts: Array<{
      type: string;
      description: string;
      amount: number;
    }>;
    total_price: number;
    currency: 'GBP';
  }
}
```

**Errors**:
- 400: Validation error (invalid coordinates, past datetime)
- 422: Route not serviceable

---

#### POST /bookings

**Description**: Create a new booking (requires authentication).

**Authentication**: Required (CUSTOMER role)

**Request Body**:
```typescript
{
  // Journey details (same as quote request)
  service_type: string;
  pickup_location: object;
  dropoff_location: object;
  pickup_datetime: string;
  passenger_count: number;
  luggage_count: number;
  vehicle_type: string;

  // Optional fields
  flight_number?: string;
  terminal?: string;
  has_meet_and_greet?: boolean;
  special_requirements?: {
    child_seats?: number;
    wheelchair_access?: boolean;
    pets?: boolean;
  };
  via_points?: array;

  // Customer details
  customer_name: string;
  customer_email: string;
  customer_phone: string;

  // Return journey
  is_return_journey?: boolean;
  return_pickup_datetime?: string;
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    booking: {
      id: string;
      booking_reference: string;
      status: 'PENDING_PAYMENT';
      quoted_price: number;
      // ... all booking details
    },
    payment_intent: {
      client_secret: string;  // For Stripe payment
      amount: number;
      currency: 'GBP';
    }
  }
}
```

**Errors**:
- 400: Validation error
- 401: Not authenticated
- 403: Not a customer
- 422: Pickup datetime in the past

---

#### GET /bookings

**Description**: Get all bookings for authenticated user.

**Authentication**: Required

**Query Parameters**:
- `status` (optional): Filter by status (PAID, ASSIGNED, COMPLETED, etc.)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `sort` (optional): Sort field (default: pickup_datetime)
- `order` (optional): Sort order (asc/desc, default: asc)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    bookings: Array<{
      id: string;
      booking_reference: string;
      status: string;
      pickup_address: string;
      dropoff_address: string;
      pickup_datetime: string;
      quoted_price: number;
      vehicle_type: string;
      // ... other fields
    }>;
  },
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

---

#### GET /bookings/:id

**Description**: Get booking details by ID.

**Authentication**: Required

**Authorization**:
- CUSTOMER: Can only view own bookings
- OPERATOR: Can view bookings for jobs they won
- ADMIN: Can view all bookings

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    id: string;
    booking_reference: string;
    status: string;
    // ... all booking fields
    job?: {
      id: string;
      status: string;
      winning_bid?: {
        bid_amount: number;
        operator: {
          company_name: string;
        }
      };
      driver_details?: {
        driver_name: string;
        driver_phone: string;
        vehicle_registration: string;
      }
    };
    transactions: Array<{
      type: string;
      amount: number;
      status: string;
      created_at: string;
    }>;
  }
}
```

**Errors**:
- 404: Booking not found
- 403: Not authorized to view this booking

---

#### PATCH /bookings/:id

**Description**: Update booking details (limited fields, only before assignment).

**Authentication**: Required (CUSTOMER role)

**Authorization**: Can only update own bookings

**Request Body**:
```typescript
{
  pickup_datetime?: string;  // Can only update if status is PENDING_PAYMENT or PAID
  passenger_count?: number;
  luggage_count?: number;
  special_requirements?: object;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    // Updated booking object
  }
}
```

**Errors**:
- 403: Cannot update booking in current status
- 404: Booking not found
- 422: Invalid update (e.g., datetime in past)

---

#### DELETE /bookings/:id

**Description**: Cancel booking.

**Authentication**: Required

**Authorization**:
- CUSTOMER: Can cancel own bookings
- ADMIN: Can cancel any booking

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    booking: {
      id: string;
      status: 'CANCELLED';
      cancelled_at: string;
    },
    refund?: {
      amount: number;
      status: string;
    }
  }
}
```

**Errors**:
- 404: Booking not found
- 422: Cannot cancel booking in current status (e.g., already completed)

---

### RETURN JOURNEY ENDPOINTS (NEW)

#### POST /bookings/return

**Description**: Create a return journey booking (outbound + return with 5% discount).

**Authentication**: Required (CUSTOMER role)

**Request Body**:
```typescript
{
  outbound: {
    pickupAddress: string;
    pickupPostcode: string;
    pickupLat: number;
    pickupLng: number;
    dropoffAddress: string;
    dropoffPostcode: string;
    dropoffLat: number;
    dropoffLng: number;
    pickupDatetime: string;       // ISO 8601 format
    passengerCount: number;
    luggageCount: number;
    vehicleType: 'SALOON' | 'ESTATE' | 'MPV' | 'EXECUTIVE' | 'MINIBUS';
    serviceType: 'AIRPORT_PICKUP' | 'AIRPORT_DROPOFF' | 'POINT_TO_POINT';
    customerPrice: number;
    flightNumber?: string;
    specialRequirements?: object;
  };
  returnJourney: {
    pickupDatetime: string;       // ISO 8601 format
    flightNumber?: string;
    specialRequirements?: object;
  };
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    isReturnJourney: true,
    bookingGroup: {
      id: string;
      groupReference: string;     // e.g., "TTS-GRP-XXXXXX"
      totalPrice: number;
      discountType: 'RETURN_JOURNEY';
      discountAmount: number;     // 5% discount
      status: 'ACTIVE';
      outbound: {
        id: string;
        bookingReference: string;
        journeyType: 'OUTBOUND';
        pickupAddress: string;
        dropoffAddress: string;
        pickupDatetime: string;
        customerPrice: number;
        status: string;
      };
      return: {
        id: string;
        bookingReference: string;
        journeyType: 'RETURN';
        pickupAddress: string;
        dropoffAddress: string;
        pickupDatetime: string;
        customerPrice: number;
        status: string;
      };
    }
  }
}
```

---

#### GET /bookings/organized

**Description**: Get all customer bookings organized by journey type (for frontend display).

**Authentication**: Required (CUSTOMER role)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    oneWayBookings: Array<BookingResponse>;
    returnJourneys: Array<{
      id: string;
      groupReference: string;
      totalPrice: number;
      discountAmount: number;
      status: 'ACTIVE' | 'PARTIALLY_CANCELLED' | 'FULLY_CANCELLED' | 'COMPLETED';
      outbound: BookingResponse;
      return: BookingResponse;
    }>;
  }
}
```

---

#### GET /bookings/groups/:groupId

**Description**: Get booking group details by ID.

**Authentication**: Required

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    id: string;
    groupReference: string;
    totalPrice: number;
    discountType: string;
    discountAmount: number;
    status: string;
    outbound: BookingResponse;
    return: BookingResponse;
    createdAt: string;
  }
}
```

---

#### POST /api/maps/quote/return

**Description**: Calculate quote for a return journey (with 5% discount).

**Authentication**: Optional

**Request Body**:
```typescript
{
  outbound: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupDatetime: string;
    vehicleType: string;
    passengerCount?: number;
    hasMeetAndGreet?: boolean;
  };
  returnJourney: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupDatetime: string;
    vehicleType: string;
    passengerCount?: number;
    hasMeetAndGreet?: boolean;
  };
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    outbound: SingleJourneyQuote;
    return: SingleJourneyQuote;
    combinedTotal: number;
    discount: {
      type: 'RETURN_JOURNEY';
      percentage: 5;
      amount: number;
    };
    finalTotal: number;
    currency: 'GBP';
  }
}
```

---

#### POST /payments/group/create-intent

**Description**: Create Stripe payment intent for a booking group (return journey).

**Authentication**: Required (CUSTOMER role)

**Request Body**:
```typescript
{
  bookingGroupId: string;
  amount: string;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    paymentIntentId: string;
    clientSecret: string;
    bookingGroupId: string;
    amount: number;
    currency: 'GBP';
    status: string;
  }
}
```

---

#### POST /payments/group/confirm

**Description**: Confirm payment for a booking group (both legs).

**Authentication**: Required (CUSTOMER role)

**Request Body**:
```typescript
{
  bookingGroupId: string;
  paymentIntentId: string;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    transactions: Array<Transaction>;
    bookingGroup: {
      id: string;
      groupReference: string;
      bookings: Array<{
        id: string;
        bookingReference: string;
        status: 'PAID';
      }>;
    }
  }
}
```

---

### JOBS ENDPOINTS

#### GET /jobs

**Description**: Get available jobs for operators (filtered by service area and vehicle types).

**Authentication**: Required (OPERATOR role)

**Authorization**: Only APPROVED operators can view jobs

**Query Parameters**:
- `status` (optional): Filter by status (default: OPEN_FOR_BIDDING)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    jobs: Array<{
      id: string;
      status: string;
      bidding_window_closes_at: string;
      booking: {
        booking_reference: string;
        pickup_address: string;
        dropoff_address: string;
        pickup_datetime: string;
        passenger_count: number;
        luggage_count: number;
        vehicle_type: string;
        quoted_price: number;  // Maximum bid amount
        special_requirements: object;
      };
      bids_count: number;  // Number of bids received
      has_user_bid: boolean;  // Has current operator bid on this job
    }>;
  },
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Errors**:
- 403: Operator not approved

---

#### GET /jobs/:id

**Description**: Get job details.

**Authentication**: Required

**Authorization**:
- OPERATOR: Can view jobs in their service area
- ADMIN: Can view all jobs

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    id: string;
    status: string;
    bidding_window_opens_at: string;
    bidding_window_closes_at: string;
    bidding_window_duration_hours: number;
    booking: {
      // Full booking details
    };
    bids: Array<{
      id: string;
      bid_amount: number;
      status: string;
      operator: {
        company_name: string;
      };
      created_at: string;
    }>;
    winning_bid?: {
      id: string;
      bid_amount: number;
      operator: {
        company_name: string;
      }
    };
    driver_details?: {
      driver_name: string;
      driver_phone: string;
      vehicle_registration: string;
    }
  }
}
```

---

### BIDS ENDPOINTS

#### POST /jobs/:jobId/bids

**Description**: Submit a bid on a job.

**Authentication**: Required (OPERATOR role)

**Authorization**: Only APPROVED operators can bid

**Request Body**:
```typescript
{
  bid_amount: number;  // Must be > 0 and <= booking.quoted_price
  notes?: string;      // Optional notes
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    id: string;
    job_id: string;
    operator_id: string;
    bid_amount: number;
    status: 'PENDING';
    notes: string;
    created_at: string;
  }
}
```

**Errors**:
- 400: Validation error (bid amount invalid)
- 403: Operator not approved
- 409: Operator already bid on this job
- 422: Bidding window closed
- 422: Job not in operator's service area
- 422: Bid amount exceeds quoted price

---

#### GET /bids

**Description**: Get all bids for authenticated operator.

**Authentication**: Required (OPERATOR role)

**Query Parameters**:
- `status` (optional): Filter by status (PENDING, WON, LOST)
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    bids: Array<{
      id: string;
      bid_amount: number;
      status: string;
      created_at: string;
      job: {
        id: string;
        status: string;
        booking: {
          booking_reference: string;
          pickup_address: string;
          dropoff_address: string;
          pickup_datetime: string;
          quoted_price: number;
        }
      }
    }>;
  },
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

---

#### DELETE /bids/:id

**Description**: Withdraw a bid (only before bidding window closes).

**Authentication**: Required (OPERATOR role)

**Authorization**: Can only withdraw own bids

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    id: string;
    status: 'WITHDRAWN';
  }
}
```

**Errors**:
- 404: Bid not found
- 422: Cannot withdraw bid (bidding window closed or bid already won)

---

### OPERATORS ENDPOINTS

#### GET /operators/dashboard

**Description**: Get operator dashboard data (earnings, active jobs, stats).

**Authentication**: Required (OPERATOR role)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    stats: {
      total_bids: number;
      won_bids: number;
      active_jobs: number;
      completed_jobs: number;
      total_earnings: number;
      pending_earnings: number;
    };
    recent_jobs: Array<{
      id: string;
      status: string;
      booking: {
        booking_reference: string;
        pickup_datetime: string;
        pickup_address: string;
        dropoff_address: string;
      };
      winning_bid: {
        bid_amount: number;
      }
    }>;
    pending_payouts: Array<{
      amount: number;
      job_count: number;
      scheduled_date: string;
    }>;
  }
}
```

---

#### POST /operators/jobs/:jobId/driver-details

**Description**: Submit driver details for assigned job.

**Authentication**: Required (OPERATOR role)

**Authorization**: Can only submit for jobs operator won

**Request Body**:
```typescript
{
  driver_name: string;
  driver_phone: string;
  vehicle_registration: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    id: string;
    job_id: string;
    driver_name: string;
    driver_phone: string;
    vehicle_registration: string;
    // ... other fields
  }
}
```

**Errors**:
- 403: Not authorized (didn't win this job)
- 409: Driver details already submitted
- 422: Job not in ASSIGNED status

---

#### PATCH /operators/profile

**Description**: Update operator profile.

**Authentication**: Required (OPERATOR role)

**Request Body**:
```typescript
{
  company_name?: string;
  vat_number?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_sort_code?: string;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    // Updated operator profile
  }
}
```

---

#### POST /operators/vehicles

**Description**: Add a vehicle to operator's fleet.

**Authentication**: Required (OPERATOR role)

**Request Body**:
```typescript
{
  vehicle_type: 'SALOON' | 'ESTATE' | 'MPV' | 'EXECUTIVE' | 'MINIBUS';
  make: string;
  model: string;
  registration: string;
  year: number;
  color?: string;
  passenger_capacity: number;
  luggage_capacity: number;
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    id: string;
    // ... vehicle details
  }
}
```

**Errors**:
- 409: Vehicle registration already exists

---

#### POST /operators/documents

**Description**: Upload operator document (license, insurance).

**Authentication**: Required (OPERATOR role)

**Request**: Multipart form data
- `document_type`: "OPERATING_LICENSE" | "INSURANCE" | "OTHER"
- `file`: File (PDF, JPG, PNG, max 5MB)

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    id: string;
    document_type: string;
    file_url: string;
    file_name: string;
    file_size: number;
    uploaded_at: string;
  }
}
```

**Errors**:
- 400: Invalid file type or size

---


### PAYMENTS ENDPOINTS

#### POST /payments/create-payment-intent

**Description**: Create Stripe Payment Intent for booking.

**Authentication**: Required (CUSTOMER role)

**Request Body**:
```typescript
{
  booking_id: string;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    client_secret: string;  // Stripe Payment Intent client secret
    amount: number;
    currency: 'GBP';
    booking_id: string;
  }
}
```

**Errors**:
- 404: Booking not found
- 422: Booking already paid

---

#### POST /payments/webhook

**Description**: Stripe webhook endpoint (handles payment confirmations, refunds).

**Authentication**: None (verified by Stripe signature)

**Headers**:
- `stripe-signature`: Stripe webhook signature

**Request Body**: Stripe event object

**Response** (200 OK):
```typescript
{
  received: true
}
```

**Events Handled**:
- `payment_intent.succeeded`: Mark booking as PAID, create job
- `payment_intent.payment_failed`: Mark booking as FAILED
- `charge.refunded`: Process refund, update booking status

---

### ADMIN ENDPOINTS

#### GET /admin/dashboard

**Description**: Get admin dashboard KPIs and stats.

**Authentication**: Required (ADMIN role)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    kpis: {
      total_bookings: number;
      total_revenue: number;
      platform_commission: number;
      active_operators: number;
      pending_operator_approvals: number;
      active_jobs: number;
      jobs_with_no_bids: number;
    };
    recent_activity: Array<{
      type: string;
      description: string;
      timestamp: string;
    }>;
    alerts: Array<{
      type: string;
      message: string;
      severity: 'INFO' | 'WARNING' | 'ERROR';
    }>;
  }
}
```

---

#### GET /admin/operators

**Description**: Get all operators with filters.

**Authentication**: Required (ADMIN role)

**Query Parameters**:
- `approval_status` (optional): Filter by status
- `search` (optional): Search by company name or email
- `page`, `limit`: Pagination

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    operators: Array<{
      id: string;
      company_name: string;
      registration_number: string;
      approval_status: string;
      reputation_score: number;
      user: {
        email: string;
        phone_number: string;
      };
      vehicles_count: number;
      active_bids_count: number;
      completed_jobs_count: number;
      created_at: string;
    }>;
  },
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

---

#### PATCH /admin/operators/:id/approval

**Description**: Approve, reject, or suspend operator.

**Authentication**: Required (ADMIN role)

**Request Body**:
```typescript
{
  approval_status: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  notes?: string;  // Reason for rejection/suspension
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    id: string;
    approval_status: string;
    updated_at: string;
  }
}
```

---

#### GET /admin/bookings

**Description**: Get all bookings (admin view).

**Authentication**: Required (ADMIN role)

**Query Parameters**:
- `status`, `date_from`, `date_to`, `search`, `page`, `limit`

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    bookings: Array<{
      // Full booking details with job, bids, transactions
    }>;
  },
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

---

#### POST /admin/jobs/:jobId/assign

**Description**: Manually assign job to operator (override bidding).

**Authentication**: Required (ADMIN role)

**Request Body**:
```typescript
{
  operator_id: string;
  bid_amount: number;  // Manual bid amount
  notes?: string;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    job: {
      id: string;
      status: 'ASSIGNED';
      winning_bid_id: string;
    }
  }
}
```

---

#### GET /admin/pricing-rules

**Description**: Get all pricing rules.

**Authentication**: Required (ADMIN role)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    pricing_rules: Array<{
      id: string;
      rule_type: string;
      vehicle_type: string;
      base_amount: number;
      percentage: number;
      is_active: boolean;
      // ... other fields
    }>;
  }
}
```

---

#### POST /admin/pricing-rules

**Description**: Create new pricing rule.

**Authentication**: Required (ADMIN role)

**Request Body**:
```typescript
{
  rule_type: 'BASE_FARE' | 'PER_MILE' | 'TIME_SURCHARGE' | 'HOLIDAY_SURCHARGE' | 'AIRPORT_FEE';
  vehicle_type?: 'SALOON' | 'ESTATE' | 'MPV' | 'EXECUTIVE' | 'MINIBUS';
  base_amount: number;
  percentage?: number;
  start_time?: string;  // "HH:MM"
  end_time?: string;
  start_date?: string;  // ISO 8601
  end_date?: string;
  airport_code?: string;
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    // Created pricing rule
  }
}
```

---

#### PATCH /admin/pricing-rules/:id

**Description**: Update pricing rule.

**Authentication**: Required (ADMIN role)

**Request Body**: Same as POST (partial update)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    // Updated pricing rule
  }
}
```

---

#### DELETE /admin/pricing-rules/:id

**Description**: Delete pricing rule.

**Authentication**: Required (ADMIN role)

**Response** (204 No Content)

---

#### POST /admin/bookings/:id/refund

**Description**: Process refund for booking.

**Authentication**: Required (ADMIN role)

**Request Body**:
```typescript
{
  amount?: number;  // Optional: partial refund (default: full refund)
  reason: string;
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    refund: {
      id: string;
      amount: number;
      status: string;
      stripe_refund_id: string;
    };
    booking: {
      id: string;
      status: 'REFUNDED';
    }
  }
}
```

---

## 7. WEBHOOKS

### Stripe Webhook Events

**Endpoint**: `POST /payments/webhook`

**Signature Verification**: Required (Stripe-Signature header)

**Events Handled**:

1. **payment_intent.succeeded**
   - Update booking status to PAID
   - Create Transaction record (CUSTOMER_PAYMENT)
   - Create Job record
   - Broadcast job to operators (email/SMS)

2. **payment_intent.payment_failed**
   - Update booking status to FAILED
   - Send notification to customer

3. **charge.refunded**
   - Create Transaction record (REFUND)
   - Update booking status to REFUNDED
   - Send notification to customer

**Webhook Response**:
```typescript
{
  received: true
}
```

**Error Handling**:
- Invalid signature: 400 Bad Request
- Event processing error: Log error, return 200 (Stripe will retry)

---

## 8. ZOD SCHEMAS

### Shared Validation Schemas

Below are the key Zod schemas used for request validation (to be placed in `packages/shared-types/schemas/`):

#### auth.schema.ts

```typescript
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone_number: z.string().min(10, 'Invalid phone number'),
  role: z.enum(['CUSTOMER', 'OPERATOR']),

  // Operator-specific fields
  company_name: z.string().optional(),
  registration_number: z.string().optional(),
  vat_number: z.string().optional(),
}).refine(
  (data) => {
    if (data.role === 'OPERATOR') {
      return !!data.company_name && !!data.registration_number;
    }
    return true;
  },
  {
    message: 'Company name and registration number required for operators',
    path: ['company_name'],
  }
);

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
```

---

#### booking.schema.ts

```typescript
import { z } from 'zod';

const LocationSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  postcode: z.string().min(1, 'Postcode is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const QuoteRequestSchema = z.object({
  service_type: z.enum(['AIRPORT_PICKUP', 'AIRPORT_DROPOFF', 'POINT_TO_POINT']),
  pickup_location: LocationSchema,
  dropoff_location: LocationSchema,
  pickup_datetime: z.string().datetime('Invalid datetime format'),
  passenger_count: z.number().int().min(1).max(16),
  luggage_count: z.number().int().min(0),
  vehicle_type: z.enum(['SALOON', 'ESTATE', 'MPV', 'EXECUTIVE', 'MINIBUS']),
  has_meet_and_greet: z.boolean().optional(),
  is_return_journey: z.boolean().optional(),
  via_points: z.array(LocationSchema).optional(),
}).refine(
  (data) => {
    const pickupDate = new Date(data.pickup_datetime);
    return pickupDate > new Date();
  },
  {
    message: 'Pickup datetime must be in the future',
    path: ['pickup_datetime'],
  }
);

export const CreateBookingSchema = QuoteRequestSchema.extend({
  flight_number: z.string().optional(),
  terminal: z.string().optional(),
  special_requirements: z.object({
    child_seats: z.number().int().min(0).optional(),
    wheelchair_access: z.boolean().optional(),
    pets: z.boolean().optional(),
  }).optional(),
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_email: z.string().email('Invalid email format'),
  customer_phone: z.string().min(10, 'Invalid phone number'),
  return_pickup_datetime: z.string().datetime().optional(),
});

export const UpdateBookingSchema = z.object({
  pickup_datetime: z.string().datetime().optional(),
  passenger_count: z.number().int().min(1).max(16).optional(),
  luggage_count: z.number().int().min(0).optional(),
  special_requirements: z.object({
    child_seats: z.number().int().min(0).optional(),
    wheelchair_access: z.boolean().optional(),
    pets: z.boolean().optional(),
  }).optional(),
});

export type QuoteRequestDto = z.infer<typeof QuoteRequestSchema>;
export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingDto = z.infer<typeof UpdateBookingSchema>;
```

---

#### bid.schema.ts

```typescript
import { z } from 'zod';

export const CreateBidSchema = z.object({
  bid_amount: z.number()
    .positive('Bid amount must be greater than 0')
    .multipleOf(0.01, 'Bid amount must have at most 2 decimal places'),
  notes: z.string().max(500, 'Notes must be at most 500 characters').optional(),
});

export type CreateBidDto = z.infer<typeof CreateBidSchema>;
```

---

#### driver-details.schema.ts

```typescript
import { z } from 'zod';

export const DriverDetailsSchema = z.object({
  driver_name: z.string().min(1, 'Driver name is required'),
  driver_phone: z.string().min(10, 'Invalid phone number'),
  vehicle_registration: z.string().min(1, 'Vehicle registration is required'),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_color: z.string().optional(),
});

export type DriverDetailsDto = z.infer<typeof DriverDetailsSchema>;
```

---

**Document Status**: ✅ Complete
**Total Endpoints**: 40+
**Next Steps**: Review API specification, then create FRONTEND_STRUCTURE.md and TAILWIND_THEME.md
