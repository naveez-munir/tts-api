# AIRPORT TRANSFER BOOKING PLATFORM - PROJECT GUIDELINES

**Version:** 1.0
**Last Updated:** December 2025
**Architecture:** Separate Backend (NestJS) + Frontend (Next.js)

---

## 1. PROJECT OVERVIEW

### Description
Marketplace platform connecting customers seeking airport transfers with registered transport operators across the UK.

### Business Model
- **Asset-light aggregator**: No vehicle ownership
- **Bidding system**: Jobs broadcast to all operators, lowest bid wins
- **Revenue model**: Commission (Customer Price - Winning Bid)
- **Primary service**: Airport transfers with point-to-point support

### Core Differentiator
Automated bidding system where all registered operators in the service area receive job notifications and compete by submitting bids. The lowest bid automatically wins, maximizing platform margin while ensuring competitive pricing.

### Target Timeline
**10-12 weeks for MVP** (Minimum Viable Product)

---

## 2. DEFINITIVE FEATURE SCOPE

### ✅ FEATURES TO IMPLEMENT (MVP PHASE)

#### 2.1 Customer Booking Flow

**Journey Input Form:**
- Pickup location (address autocomplete via Google Maps Places API)
- Drop-off location (address autocomplete)
- Date and time selection (with timezone handling)
- Passenger count (1-16+)
- Luggage count (standard suitcases, hand luggage)
- Vehicle type selection (Saloon, Estate, MPV, Executive, Minibus)
- Special requirements (child seats, wheelchair access, pets)
- Flight number (text field only - NO API integration)
- Return journey option (with 5% discount calculation)
- Via points / multiple stops support

**Quote Generation Engine:**
- Real-time distance calculation via Google Maps Distance Matrix API
- Base fare + distance-based pricing (per-mile rate)
- Vehicle type pricing multipliers
- Time-based surcharges (night rates 10pm-6am, peak hours)
- Holiday surcharges (Christmas/New Year - 50% markup)
- Airport fees and tolls inclusion
- Return journey discount (5% when booked together)
- Meet & Greet add-on pricing

**Customer Details Collection:**
- Name, email, phone number
- Passenger contact information (lead passenger)

**Payment Processing:**
- Stripe integration (card, Apple Pay, Google Pay)
- 3D Secure authentication (SCA compliance)
- Full payment collected upfront
- Payment intent creation with metadata

**Booking Confirmation:**
- Unique booking reference generation (alphanumeric code)
- Instant email confirmation with complete booking details
- Booking stored with status: PENDING_PAYMENT → PAID

#### 2.2 Bidding System (Core Feature)

**Job Broadcasting:**
- Automatic broadcast to ALL registered operators in service area upon payment completion
- Job details shared: pickup/drop-off, date/time, vehicle type, passenger count, luggage, special requirements
- Customer-paid price displayed as maximum ceiling
- Email notifications to operators about new jobs
- SMS notifications to operators (urgent alerts)

**Operator Bid Submission:**
- Operators view available jobs in their service area
- Submit bid amount (must be ≤ customer-paid price)
- Bid validation and storage
- Real-time bid tracking

**Bidding Window:**
- Configurable duration (2-24 hours based on job urgency/lead time)
- Automatic closure when window expires
- Early closure option for admin

**Winner Selection:**
- Automatic: Lowest bid wins
- Tiebreaker: Operator reputation score (if bids are equal)
- Job locked to winning operator
- Platform margin calculated: Customer Price - Winning Bid
- Winning operator notified via email/SMS

**Fallback Mechanism:**
- If no bids received within window: escalate to admin
- Admin can manually assign to operator
- Admin can contact operators directly
- Customer notification if job cannot be fulfilled
- Automatic full refund processing

#### 2.3 Transport Company Portal

**Registration & Onboarding:**
- Company details form (name, registration number, VAT number)
- Operating license upload (PDF/image)
- Insurance documentation upload (PDF/image)
- Service areas selection (postcodes/regions covered)
- Available vehicle types selection
- Admin approval workflow (PENDING → APPROVED → ACTIVE)

**Dashboard:**
- Available jobs in service area (filtered by vehicle types operator has)
- Active bids submitted
- Won/assigned jobs
- Completed jobs history
- Earnings summary (total, pending, paid)

**Job Management:**
- View job details (pickup, dropoff, requirements, customer price ceiling)
- Submit bid on available jobs
- View bid status (PENDING, WON, LOST)
- For assigned jobs: submit driver details (name, phone, vehicle registration)
- Mark job as completed

**Financial Management:**
- Earnings dashboard with job history
- Bank details management for payouts
- Invoice generation (PDF download)
- Payout schedule display (weekly/bi-weekly)

#### 2.4 Admin Panel

**Dashboard:**
- KPIs: Total bookings, revenue, active operators, pending approvals, active bids
- Recent activity feed
- Alerts (no bids received, operator registration pending, disputes)

**Operator Management:**
- Approve/reject operator registrations
- View operator profiles and documents
- Suspend/activate operator accounts
- View operator performance ratings and history
- Manage operator service areas

**Booking Management:**
- View all bookings (with filters: status, date range, operator)
- View booking details
- Modify bookings (date/time changes)
- Cancel bookings
- Process refunds (full/partial)

**Bidding Monitoring:**
- Real-time view of all active bids
- See all bids for each job
- Manual job assignment capability (override automatic selection)
- Close bidding window early
- Escalated jobs (no bids received)


**Pricing Rules Configuration:**
- Base fares by vehicle type
- Per-mile rates
- Time-based surcharges (configure time ranges and percentages)
- Holiday surcharge dates and percentages
- Airport fees by airport
- Manage return journey discount percentage

**Financial Reports:**
- Revenue by period (daily, weekly, monthly)
- Operator payouts summary
- Commission earned
- Refunds processed
- Transaction history
- Export to CSV/Excel

**Customer Support Tools:**
- Booking search (by reference, customer email, phone)
- Customer booking history
- Communication logs
- Issue resolution tracking

**Payout Management:**
- Configure payout schedule (weekly/bi-weekly)
- Process payouts to operators
- View payout history
- Mark payouts as completed

#### 2.5 Payment Processing

**Customer Payments (Stripe):**
- Payment Intent creation with booking metadata
- Support for card payments, Apple Pay, Google Pay
- 3D Secure (SCA) authentication
- Payment confirmation webhook handling
- Payment status tracking (PENDING, COMPLETED, FAILED)

**Operator Payouts:**
- Stripe Connect integration (optional for MVP) OR manual bank transfers
- Payout scheduling (weekly or bi-weekly configurable)
- Payout amount = Winning Bid Amount
- Payout status tracking

**Refund Processing:**
- Full refunds for cancelled/unfulfilled bookings
- Partial refunds (admin discretion)
- Refund webhook handling
- Transaction history logging

**Transaction Management:**
- All transactions logged (customer payments, operator payouts, refunds, platform commission)
- Reconciliation reports
- Stripe transaction ID tracking

#### 2.6 Google Maps Integration

**APIs Used:**
- **Places API**: Address autocomplete and validation
- **Distance Matrix API**: Distance and duration calculation for quote generation
- **Geocoding API**: Convert addresses to coordinates (lat/lng)

**Implementation Requirements:**
- Proper error handling for API failures
- Caching strategy to minimize API costs (cache common routes for 24 hours)
- Rate limiting awareness
- Fallback for API downtime (use cached data or manual entry)

#### 2.7 Notification System

**Email Notifications (SendGrid or Mailgun):**

*Customer Emails:*
- Booking acknowledgement (after payment)
- Journey details (after driver assigned - includes driver name, phone, vehicle)
- Booking modification confirmation
- Booking cancellation confirmation
- Refund processed notification

*Operator Emails:*
- New job alert (when job broadcast)
- Bid won notification
- Job assignment confirmation
- Payment/payout confirmation

*Admin Emails:*
- No bids received alert (escalation)
- Operator registration pending approval
- Dispute notifications

**SMS Notifications (Twilio):**

*Customer SMS:*
- Booking confirmation with reference number
- Journey details 24 hours before pickup (driver info)

*Operator SMS:*
- Urgent job alerts (jobs with short lead time)
- Bid won notification

**Notification Features:**
- Template management (HTML email templates)
- Delivery tracking (sent, failed, bounced)
- Retry logic (3 attempts for failed notifications)
- Notification preferences (users can opt-in/out of SMS)

#### 2.8 Service Types

**Airport Pickup:**
- Flight number collection (text field, stored as VARCHAR)
- Terminal selection (dropdown)
- Meet & Greet option (additional fee)
- Waiting time included (60 minutes standard)

**Airport Drop-off:**
- Terminal selection (dropdown)
- Recommended 2-hour buffer before flight time
- Drop-off instructions

**Point-to-Point:**
- Any location to any location
- Via points support (multiple stops)
- Distance-based pricing

#### 2.9 Vehicle Types

| Vehicle Type | Passengers | Luggage | Description |
|--------------|------------|---------|-------------|
| Saloon | 1-4 | 2 large, 2 hand | Standard sedan (e.g., Toyota Prius, VW Passat) |
| Estate | 1-4 | 4 large, 2 hand | Estate car with extra luggage space |
| MPV/People Carrier | 5-6 | 4 large, 4 hand | 7-seater (e.g., Ford Galaxy, VW Sharan) |
| Executive | 1-4 | 2 large, 2 hand | Premium sedan (e.g., Mercedes E-Class, BMW 5 Series) |
| Minibus | 7-16 | 10+ large | Large group transport |

#### 2.10 Authentication & Authorization

**Authentication System:**
- Multi-role authentication using **Passport.js** with NestJS
- JWT-based authentication (access token + refresh token)
- Secure password hashing (bcrypt)
- Email verification for new accounts
- Password reset functionality (email link with token)

**User Roles:**
- **CUSTOMER**: Can create bookings, view own bookings, make payments
- **OPERATOR**: Can view jobs, submit bids, manage assigned jobs, view earnings
- **ADMIN**: Full access to all features, operator approval, pricing configuration

**Authorization (RBAC):**
- Role-based access control on all API endpoints
- Guards for route protection
- Permission checks in services
- Frontend route protection based on user role


---

### ❌ FEATURES EXPLICITLY OUT OF SCOPE (DO NOT IMPLEMENT)

**Flight Tracking:**
- ❌ Flight tracking API integration (AviationStack, FlightAware, OpenSky)
- ❌ Automatic flight status monitoring and polling
- ❌ Auto-adjustment of pickup times based on real-time flight delays/early arrivals
- ❌ Terminal and gate information display from APIs
- ✅ Flight number is collected as TEXT ONLY (no validation, no API calls)

**Driver & Vehicle Management:**
- ❌ Driver mobile application
- ❌ Real-time GPS tracking of drivers during journey
- ❌ Driver dashboard or driver management interface
- ❌ Vehicle dispatch management system
- ❌ Driver ratings or performance tracking
- ✅ Operators manage their own drivers externally

**Communication Features:**
- ❌ In-app chat or messaging between customers/operators/drivers
- ❌ Real-time notifications (WebSockets, push notifications)
- ✅ Email and SMS notifications only

**Marketing & Loyalty:**
- ❌ Customer loyalty programs or points system
- ❌ Referral systems or affiliate programs
- ❌ Promotional codes or discount coupons
- ❌ Dynamic pricing based on demand
- ❌ Surge pricing

**Advanced Features:**
- ❌ Multi-language support (English only for MVP)
- ❌ Multi-currency support (GBP £ only for MVP)
- ❌ Corporate account management with monthly invoicing
- ❌ Event bookings or group booking management
- ❌ Itinerary management
- ❌ Customer reviews and ratings system (collect data but no public display)
- ❌ Operator public profiles or marketplace browsing
- ❌ Advanced analytics and reporting dashboards
- ❌ Mobile apps (iOS/Android) - web-only for MVP

---

## 3. STRICT SCOPE CONTROL RULES FOR AI DEVELOPMENT

When working on this project, the AI assistant MUST adhere to these rules:

### Prohibited Actions:
- ✋ **NO feature suggestions** beyond the defined scope during development
- ✋ **NO "nice to have" additions** or enhancements unless explicitly requested
- ✋ **NO future-proofing** beyond current requirements (don't add fields "for future use")
- ✋ **NO over-engineering** - implement the simplest solution that meets requirements
- ✋ **NO copying** ots-uk.co.uk design, layout, colors, or content (copyright risk)

### Required Actions:
- ✅ **Flight number field** should be collected and stored as plain text only (VARCHAR/TEXT) - no API integration, no validation beyond basic format
- ✅ **Focus exclusively** on delivering the defined MVP features
- ✅ **Any scope changes** must be explicitly approved by the user and documented in this file
- ✅ **When in doubt**, ask the user rather than making assumptions or adding features
- ✅ **Prioritize completion** over perfection - working MVP is better than incomplete feature-rich application
- ✅ **Use ots-uk.co.uk ONLY as functional reference** (what features they have, how flows work)
- ✅ **Create 100% original design** and copywriting

---

## 4. ARCHITECTURE & TECHNICAL STACK

### Architecture Overview

**Separate Backend and Frontend Applications:**

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND APPLICATION                      │
│  Next.js 16 + React 19 + TypeScript + Tailwind CSS         │
│  Deployed on: Vercel                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    REST API (JSON)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND APPLICATION                       │
│  NestJS + TypeScript + Prisma ORM                           │
│  Deployed on: Railway or Render                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────┐  ┌──────────────────────┐
│   PostgreSQL 15+     │  │   Redis (BullMQ)     │
│   (Relational DB)    │  │   (Job Queue)        │
│   Railway/Supabase   │  │   Upstash/Railway    │
└──────────────────────┘  └──────────────────────┘
```

### Frontend Application

**Framework & Libraries:**
- **Framework**: Next.js 16 with App Router
- **UI Library**: React 19
- **Language**: TypeScript 5 (strict mode enabled)
- **Styling**: Tailwind CSS 4
- **Form Handling**: React Hook Form with Zod validation
- **State Management**:
  - React Context API for auth state
  - Zustand for complex state (booking flow, multi-step forms)
- **HTTP Client**: Axios with custom wrapper for API calls
- **Authentication**: JWT-based (tokens stored in httpOnly cookies)
- **Deployment**: Vercel

**Key Features:**
- Server-side rendering (SSR) for SEO
- Client-side routing with App Router
- Responsive design (mobile-first)
- Progressive enhancement
- Optimized images (Next.js Image component)

### Backend Application

**Framework & Libraries:**
- **Runtime**: Node.js 20+ LTS
- **Framework**: NestJS (TypeScript-based)
- **Language**: TypeScript 5 (strict mode enabled)
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5+
- **Authentication**: Passport.js with JWT strategy
- **Job Queue**: BullMQ with Redis
- **Validation**: Zod schemas for request/response validation
- **API Documentation**: Swagger/OpenAPI (auto-generated)
- **Deployment**: Railway or Render

**Architecture Pattern:**
- **Controllers**: Handle HTTP requests, validate input (DTOs)
- **Services**: Business logic, orchestration
- **Repositories**: Data access layer (Prisma)
- **Guards**: Authentication and authorization
- **Interceptors**: Response transformation, logging
- **Pipes**: Validation (Zod validation pipe)
- **Jobs**: Background tasks (BullMQ workers)

### Database & Infrastructure

**Database:**
- **PostgreSQL 15+** on Supabase or Railway
- Relational database for data integrity
- ACID compliance for financial transactions
- Proper indexes for performance

**Redis:**
- **Upstash Redis** or Railway Redis
- Job queue storage (BullMQ)
- Caching layer (optional for MVP)
- Session storage (optional)

**File Storage:**
- **AWS S3** or **Cloudinary** for operator document uploads
- Secure signed URLs for document access
- File type validation (PDF, JPG, PNG only)
- File size limits (5MB per document)

### Third-Party Integrations

| Service | Purpose | Estimated Cost | Priority |
|---------|---------|----------------|----------|
| **Stripe** | Payment processing, payouts | 2.9% + 30p per transaction | Critical |
| **Google Maps API** | Distance calculation, autocomplete | ~£5-7 per 1000 requests | Critical |
| **SendGrid/Mailgun** | Transactional emails | Free - £20/month | Critical |
| **Twilio** | SMS notifications | ~£0.04 per SMS | High |
| **AWS S3/Cloudinary** | File storage | £5-10/month | High |



### Shared Types Package

**Purpose**: Ensure type consistency between frontend and backend

**Structure:**
```
packages/shared-types/
├── index.ts              # Main export file
├── user.types.ts         # User, OperatorProfile types
├── booking.types.ts      # Booking, Job, Bid types
├── payment.types.ts      # Transaction, Payment types
├── enums.ts              # All enums (UserRole, BookingStatus, etc.)
└── schemas/              # Zod schemas
    ├── booking.schema.ts
    ├── user.schema.ts
    └── bid.schema.ts
```

**Usage:**
- Backend imports for validation and type safety
- Frontend imports for form validation and API types
- Single source of truth for data structures

**Example:**
```typescript
// packages/shared-types/enums.ts
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  OPERATOR = 'OPERATOR',
  ADMIN = 'ADMIN'
}

export enum BookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

// packages/shared-types/schemas/booking.schema.ts
import { z } from 'zod';

export const CreateBookingSchema = z.object({
  pickupLocation: z.object({
    address: z.string().min(1),
    postcode: z.string().min(1),
    lat: z.number(),
    lng: z.number()
  }),
  dropoffLocation: z.object({
    address: z.string().min(1),
    postcode: z.string().min(1),
    lat: z.number(),
    lng: z.number()
  }),
  pickupDatetime: z.string().datetime(),
  passengerCount: z.number().min(1).max(16),
  luggageCount: z.number().min(0),
  vehicleType: z.enum(['SALOON', 'ESTATE', 'MPV', 'EXECUTIVE', 'MINIBUS']),
  flightNumber: z.string().optional(),
  specialRequirements: z.object({
    childSeats: z.number().optional(),
    wheelchairAccess: z.boolean().optional(),
    pets: z.boolean().optional()
  }).optional()
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
```

---

## 5. CODE CONSISTENCY STANDARDS

### TypeScript Standards

**Shared Types Location:**
- Create `packages/shared-types` directory in monorepo
- Export all shared types, interfaces, enums, and Zod schemas
- Both frontend and backend import from this shared location
- Keep frontend-specific and backend-specific types in their respective projects

**Type Definitions:**
- Enable `strict: true` in tsconfig.json for both projects
- Use `interface` for object shapes that may be extended, `type` for unions/intersections
- Avoid `any` type - use `unknown` and type guards if type is truly unknown
- Use `enum` for fixed sets of values (e.g., UserRole, BookingStatus, VehicleType)
- Define Zod schemas alongside TypeScript types for runtime validation
- Use `z.infer<typeof schema>` to derive TypeScript types from Zod schemas

**Naming Conventions:**
- Types/Interfaces: PascalCase (e.g., `UserProfile`, `BookingRequest`)
- Enums: PascalCase for enum name, SCREAMING_SNAKE_CASE for values (e.g., `enum UserRole { CUSTOMER = 'CUSTOMER' }`)
- Variables/Functions: camelCase (e.g., `calculateQuote`, `bookingData`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_PASSENGERS`, `DEFAULT_BIDDING_WINDOW`)
- React Components: PascalCase (e.g., `BookingForm`, `VehicleCard`)

**File Naming Conventions:**
- ✅ **React Component Files**: PascalCase (e.g., `BookingForm.tsx`, `CtaSection.tsx`, `Header.tsx`)
- ✅ **Route Folders** (Next.js app directory): kebab-case (e.g., `app/operators/`, `app/about/`)
- ✅ **Utility/Helper Files**: camelCase (e.g., `utils.ts`, `constants.ts`)
- ❌ **Avoid**: kebab-case for component files (e.g., `booking-form.tsx` ❌), camelCase for components (e.g., `bookingForm.tsx` ❌), snake_case (e.g., `booking_form.tsx` ❌)

**Rationale**: PascalCase for component files ensures consistency between the component name and the filename, making imports clearer and preventing case-sensitivity issues across different operating systems.

---

### NestJS Backend Standards

#### **TypeScript Configuration**

**Required tsconfig.json settings**:
```json
{
  "compilerOptions": {
    "strict": true,                          // Enable strict mode
    "noImplicitAny": true,                   // Disallow implicit any
    "strictNullChecks": true,                // Strict null checks
    "strictFunctionTypes": true,             // Strict function types
    "strictBindCallApply": true,             // Strict bind/call/apply
    "strictPropertyInitialization": true,   // Strict property initialization
    "noImplicitThis": true,                  // No implicit this
    "alwaysStrict": true,                    // Always strict mode
    "noUnusedLocals": true,                  // Error on unused locals
    "noUnusedParameters": true,              // Error on unused parameters
    "noImplicitReturns": true,               // Error on implicit returns
    "noFallthroughCasesInSwitch": true,      // Error on fallthrough cases
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]                       // Path alias for imports
    },
    "target": "ES2023",
    "module": "commonjs",
    "lib": ["ES2023"],
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

#### **NestJS Module Structure**

**Feature Module Organization**:
```
src/modules/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   └── auth-response.dto.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── local-auth.guard.ts
│   └── auth.service.spec.ts
├── users/
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   └── user-response.dto.ts
│   └── users.service.spec.ts
├── bookings/
├── jobs/
├── bids/
├── operators/
├── payments/
└── notifications/
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── optional-jwt.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── interceptors/
│   │   ├── response.interceptor.ts
│   │   └── logging.interceptor.ts
│   ├── pipes/
│   │   ├── zod-validation.pipe.ts
│   │   └── parse-uuid.pipe.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── types/
│       └── index.ts
├── database/
│   ├── prisma.service.ts
│   └── migrations/
├── config/
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── app.config.ts
└── app.module.ts
```

#### **NestJS Coding Standards**

**Controllers**:
```typescript
// ✅ CORRECT
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
```

**Services**:
```typescript
// ✅ CORRECT
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }
}
```

**DTOs (Data Transfer Objects)**:
```typescript
// ✅ CORRECT - Use Zod for validation
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['CUSTOMER', 'OPERATOR', 'ADMIN']),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
```

**Guards**:
```typescript
// ✅ CORRECT
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Decorators**:
```typescript
// ✅ CORRECT
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

**Interceptors**:
```typescript
// ✅ CORRECT
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

**Exception Filters**:
```typescript
// ✅ CORRECT
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse() as string;
    }

    response.status(status).json({
      success: false,
      error: {
        code: 'ERROR',
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Validation Pipe**:
```typescript
// ✅ CORRECT - Zod Validation Pipe
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors,
        },
      });
    }
  }
}
```

#### **NestJS Best Practices**

1. **Dependency Injection**:
   - Always use constructor injection
   - Use `readonly` for injected dependencies
   - Avoid circular dependencies

2. **Error Handling**:
   - Use NestJS built-in exceptions (BadRequestException, NotFoundException, etc.)
   - Create custom exceptions for domain-specific errors
   - Use exception filters for global error handling

3. **Logging**:
   - Use NestJS Logger service
   - Log at appropriate levels (debug, log, warn, error)
   - Never log sensitive data (passwords, tokens, credit cards)

4. **Testing**:
   - Write unit tests for services
   - Write integration tests for controllers
   - Use `@nestjs/testing` module
   - Mock external dependencies

5. **Modules**:
   - Keep modules focused and single-responsibility
   - Export only what's needed
   - Use feature modules for each domain
   - Import shared modules in feature modules

6. **Async/Await**:
   - Always use async/await for async operations
   - Avoid callback hell
   - Handle errors with try-catch

#### **Database Integration (Prisma)**

**Replace TypeORM with Prisma**:
```typescript
// ✅ CORRECT - Prisma Service
import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
```

**Usage in Services**:
```typescript
// ✅ CORRECT
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        operatorProfile: true,
      },
    });
  }
}
```

### Database Field Naming

- Use snake_case for all PostgreSQL column names (e.g., `first_name`, `created_at`, `booking_reference`)
- Prisma will auto-map to camelCase in generated client (e.g., `firstName`, `createdAt`, `bookingReference`)
- Boolean fields: prefix with `is_` or `has_` (e.g., `is_active`, `has_wheelchair_access`)
- Timestamp fields: suffix with `_at` (e.g., `created_at`, `updated_at`, `completed_at`)
- Foreign keys: suffix with `_id` (e.g., `user_id`, `operator_id`, `booking_id`)

### API Naming Conventions

**Endpoint Structure (RESTful):**
- Use kebab-case for multi-word resources: `/api/transport-companies`, `/api/pricing-rules`
- Resource-based URLs: `/api/bookings`, `/api/jobs`, `/api/bids`
- Use HTTP methods correctly: GET (read), POST (create), PUT/PATCH (update), DELETE (delete)
- Nested resources: `/api/jobs/:jobId/bids`, `/api/bookings/:bookingId/transactions`
- Actions that don't fit REST: POST `/api/jobs/:jobId/assign`, POST `/api/bookings/:bookingId/refund`

**Examples:**
- `GET /api/bookings` - List all bookings (with pagination, filters)
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/:id` - Get booking details
- `PATCH /api/bookings/:id` - Update booking
- `POST /api/jobs/:jobId/bids` - Submit bid on job
- `GET /api/operators/dashboard` - Get operator dashboard data

### API Response Format

**Success Response:**
```typescript
{
  success: true,
  data: { /* response payload */ },
  meta: { /* pagination, timestamps, etc. */ }
}
```

**Error Response:**
```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR', // machine-readable error code
    message: 'Invalid booking details', // human-readable message
    details: [ /* array of specific validation errors */ ]
  }
}
```

**HTTP Status Codes:**
- 200: Success (GET, PATCH, PUT)
- 201: Created (POST)
- 204: No Content (DELETE)
- 400: Bad Request (validation errors)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (authenticated but not authorized)
- 404: Not Found
- 409: Conflict (e.g., duplicate booking reference)
- 500: Internal Server Error



### Component Structure

**Frontend Directory Organization:**
```
frontend/
├── app/                    # Next.js App Router pages
│   ├── (marketing)/       # Marketing pages (landing, about, etc.)
│   ├── (booking)/         # Booking flow pages
│   ├── dashboard/         # Customer dashboard
│   ├── operator/          # Operator portal
│   ├── admin/             # Admin panel
│   └── api/               # API route handlers (if any client-side API routes)
├── components/
│   ├── ui/                # Reusable UI components (Button, Input, Card, etc.)
│   ├── forms/             # Form components (BookingForm, BidForm, etc.)
│   ├── layout/            # Layout components (Header, Footer, Sidebar)
│   └── features/          # Feature-specific components
├── lib/
│   ├── api/               # API client functions
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   ├── validations/       # Zod schemas for forms
│   └── constants.ts       # App constants
├── types/                 # Frontend-specific types
└── styles/                # Global styles, Tailwind config
```

**Backend Directory Organization:**
```
backend/
├── src/
│   ├── modules/           # NestJS modules (feature-based)
│   │   ├── auth/
│   │   ├── bookings/
│   │   ├── jobs/
│   │   ├── bids/
│   │   ├── operators/
│   │   ├── payments/
│   │   └── notifications/
│   ├── common/            # Shared code
│   │   ├── guards/        # Auth guards, role guards
│   │   ├── interceptors/  # Response transformation, logging
│   │   ├── pipes/         # Validation pipes (Zod)
│   │   ├── decorators/    # Custom decorators
│   │   └── filters/       # Exception filters
│   ├── integrations/      # Third-party API integrations
│   │   ├── stripe/
│   │   ├── google-maps/
│   │   ├── sendgrid/
│   │   └── twilio/
│   ├── jobs/              # BullMQ job processors
│   ├── prisma/            # Prisma service
│   ├── config/            # Configuration files
│   └── main.ts            # Application entry point
├── prisma/
│   ├── schema.prisma      # Prisma schema
│   ├── migrations/        # Database migrations
│   └── seed.ts            # Database seeding script
└── test/                  # Test files
```

**Code Quality Standards:**
- Use ESLint with TypeScript rules for both projects
- Use Prettier for consistent code formatting
- Write JSDoc comments for complex functions and public APIs
- Separate business logic from presentation (services pattern in backend, custom hooks in frontend)
- Use custom hooks for reusable logic in React components
- Keep components small and focused (single responsibility)
- Prefer composition over prop drilling (use Context API for deeply nested state)

---

## 6. DEVELOPMENT WORKFLOW & BEST PRACTICES

### Git Workflow

- Branch naming: `feature/booking-flow`, `fix/payment-validation`, `refactor/api-responses`
- Commit message format: `type(scope): description` (e.g., `feat(booking): add quote calculation`, `fix(auth): resolve token expiration`)
- Types: feat, fix, refactor, docs, test, chore
- Keep commits atomic and focused
- Write descriptive commit messages explaining "why" not just "what"

### Testing Requirements

**Backend Testing:**
- Unit tests for services and utility functions (Jest)
- Integration tests for API endpoints (Supertest)
- Test database operations with test database or mocks
- Test coverage target: 70%+ for critical paths (booking flow, bidding system, payment processing)

**Frontend Testing:**
- Component tests for UI components (React Testing Library)
- Integration tests for forms and user flows
- E2E tests for critical paths (Playwright or Cypress) - optional for MVP
- Test coverage target: 60%+ for critical components

### Code Review Checklist

- [ ] TypeScript strict mode compliance (no `any`, proper types)
- [ ] Zod validation for all user inputs and API requests
- [ ] Error handling implemented (try-catch, error boundaries)
- [ ] Loading and error states in UI
- [ ] Responsive design tested at multiple breakpoints
- [ ] Accessibility: keyboard navigation, ARIA labels, color contrast
- [ ] No hardcoded values (use environment variables for config)
- [ ] No sensitive data in logs or client-side code
- [ ] Database queries optimized (proper indexes, avoid N+1 queries)
- [ ] API responses follow standard format
- [ ] Proper HTTP status codes used
- [ ] Authentication and authorization checks in place
- [ ] Input sanitization to prevent XSS/SQL injection
- [ ] Rate limiting on sensitive endpoints (login, payment)

### Environment Variables

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

**Backend (.env):**
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_MAPS_API_KEY=...
SENDGRID_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
```

### Deployment Process

**Frontend (Vercel):**
1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Automatic deployments on push to main branch
4. Preview deployments for pull requests

**Backend (Railway/Render):**
1. Connect GitHub repository to Railway/Render
2. Configure environment variables
3. Set up PostgreSQL and Redis add-ons
4. Configure build command: `npm run build`
5. Configure start command: `npm run start:prod`
6. Set up health check endpoint: `GET /health`

**Database Migrations:**
- Run `npx prisma migrate deploy` in production
- Never run `prisma migrate dev` in production
- Always test migrations in staging environment first


### Monitoring & Logging

- Use structured logging (Winston or Pino in NestJS)
- Log levels: error, warn, info, debug
- Never log sensitive data (passwords, tokens, credit card numbers)
- Set up error tracking (Sentry or similar) - optional for MVP
- Monitor API response times and error rates
- Set up database query monitoring

---

## 7. DESIGN & RESPONSIVENESS STANDARDS

### Design Principles

- ⚠️ **CRITICAL**: Create 100% original design and copywriting
- ⚠️ **DO NOT copy** ots-uk.co.uk design, layout, color scheme, or content (copyright infringement risk)
- ✅ **Use ots-uk.co.uk ONLY as functional reference** (what features they have, how booking flow works)
- ✅ **Create unique branding**: original color palette, typography, logo concept, UI patterns
- ✅ **Professional aesthetic**: trustworthy, modern, clean design appropriate for transport booking
- ✅ **Accessibility**: WCAG 2.1 AA compliance (color contrast, keyboard navigation, screen reader support)

### Tailwind CSS Configuration Requirements

**Using Tailwind CSS 4 with `@theme inline` in `globals.css`:**
- All colors defined in `@theme inline` block - NO hardcoded hex values in components
- Define color palette with semantic names: primary, secondary, accent, neutral, success, warning, error
- Each color should have shades: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900
- All spacing values in `@theme inline` if custom values needed
- Typography scale (font families, sizes, line heights) in `@theme inline`
- Border radius values in `@theme inline`
- Box shadows in `@theme inline`
- Breakpoints in `@theme inline`
- Easy theme switching: changing values in `@theme inline` should update entire app

**CRITICAL: Global CSS Rules:**
- ❌ **NEVER add global element styles** (`*`, `html`, `body`, `a`, `button`, etc.) that override Tailwind defaults
- ❌ **NEVER add global resets** like `margin: 0`, `padding: 0` on universal selector
- ❌ **NEVER add custom utility classes** in global CSS (`.container`, `.btn`, etc.) - use Tailwind utilities or create components
- ❌ **NEVER add global styles** that affect spacing, display, positioning, or any CSS properties Tailwind controls
- ✅ **ONLY use `globals.css` for**: `@import "tailwindcss"` and `@theme inline` configuration block
- ✅ **Component-specific styles**: Create styled components or use Tailwind utilities in className
- ✅ **Follow Tailwind CSS 4 best practices**: Keep global CSS minimal, let Tailwind handle all styling

### Responsive Design Requirements

**Mobile-First Approach:**
- Design for mobile first (320px minimum width), then scale up
- All layouts must work on: iPhone SE (375px), standard mobile (390px-428px), tablets (768px-1024px), desktop (1280px+)
- Test at various viewport heights: 600px, 800px, 1080px, 1440px

**Breakpoint Strategy:**
- sm: 640px (large phones, small tablets)
- md: 768px (tablets)
- lg: 1024px (small laptops)
- xl: 1280px (desktops)
- 2xl: 1536px (large desktops)

**Responsive Rules:**
- ❌ **NEVER use hardcoded pixel values** like `w-[900px]`, `h-[450px]`, `text-[18px]`
- ✅ **ALWAYS use Tailwind utility classes** with theme values: `w-full`, `max-w-4xl`, `h-screen`, `text-lg`
- ✅ **Use responsive variants**: `w-full md:w-1/2 lg:w-1/3`
- ✅ **Flexible layouts**: Use flexbox and grid with responsive classes
- ✅ **Touch-friendly**: Minimum 44px × 44px tap targets on mobile (buttons, links, form inputs)
- ✅ **Readable text**: Minimum 16px base font size on mobile, proper line height (1.5-1.75)
- ✅ **Proper spacing**: Adequate padding and margins that scale with breakpoints

---

## 8. SUMMARY & NEXT STEPS

This document serves as the **single source of truth** for the Airport Transfer Booking Platform project. All development decisions, architecture choices, and feature implementations must align with the guidelines defined here.

### Key Takeaways

1. **Scope Discipline**: Only implement features listed in Section 2.1-2.10. No additions without explicit approval.
2. **Architecture**: Separate NestJS backend + Next.js frontend with shared types package.
3. **Core Feature**: Bidding system where operators compete for jobs - this is the differentiator.
4. **Timeline**: 10-12 weeks for MVP with focused scope.
5. **Quality**: Type-safe, tested, accessible, responsive, and secure.

### Before Starting Development

- [ ] Review and approve this CLAUDE.md document
- [ ] Review DATABASE_SCHEMA.md (to be created)
- [ ] Review API_SPECIFICATION.md (to be created)
- [ ] Review FRONTEND_STRUCTURE.md (to be created)
- [ ] Review TAILWIND_THEME.md (to be created)
- [ ] Set up development environment (Node.js, PostgreSQL, Redis)
- [ ] Register for API accounts (Stripe, Google Maps, SendGrid, Twilio)
- [ ] Create project repositories (monorepo or separate repos)

### Development Order (Recommended)

1. **Phase 1**: Project setup, database schema, authentication
2. **Phase 2**: Customer booking flow, quote engine, Google Maps integration
3. **Phase 3**: Stripe payment integration, booking confirmation
4. **Phase 4**: Operator portal, registration, job viewing
5. **Phase 5**: Bidding system, job assignment, notifications
6. **Phase 6**: Admin panel, operator management, reports
7. **Phase 7**: Testing, bug fixes, security audit
8. **Phase 8**: Deployment, monitoring setup

---

**Document Status**: ✅ Complete
**Next Action**: Create remaining documentation files (DATABASE_SCHEMA.md, API_SPECIFICATION.md, FRONTEND_STRUCTURE.md, TAILWIND_THEME.md)