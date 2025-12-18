PROJECT_RULES_SUMMARY
1. PROJECT OVERVIEW
Platform: Airport Transfer Booking Marketplace (UK)
Business Model: Asset-light aggregator with bidding system
Revenue: Commission = Customer Price - Winning Bid
Core Differentiator: Lowest bid wins automatically Architecture:
Backend: NestJS + TypeScript + TypeOrm + PostgreSQL + Redis (BullMQ)
Frontend: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
Shared Types: packages/shared-types/ (Zod schemas + TypeScript types)
2. SCOPE RULES
DO Implement (MVP)
Customer booking flow with quote engine
Bidding system (job broadcast → operator bids → lowest wins)
Operator portal (registration, job viewing, bid submission, driver details)
Admin panel (operator approval, booking management, pricing rules)
Payment processing (Stripe)
Notifications (email via SendGrid, SMS via Twilio)
Google Maps integration (Places, Distance Matrix, Geocoding)
DO NOT Implement
Flight tracking API integration (flight number = TEXT ONLY)
Driver mobile app / GPS tracking / driver dashboard
In-app chat / WebSockets / push notifications
Loyalty programs / referrals / promo codes / dynamic pricing
Multi-language / multi-currency (English + GBP only)
Corporate accounts / mobile apps
AI Constraints
NO feature suggestions beyond scope
NO future-proofing / over-engineering
NO copying ots-uk.co.uk design (functional reference only)
When in doubt, ASK the user
3. NAMING CONVENTIONS
Context	Convention	Example
DB columns	snake_case	first_name, created_at
typeorm	camelCase (auto-mapped)	firstName, createdAt
Types/Interfaces	PascalCase	UserProfile, BookingRequest
Enums	PascalCase + SCREAMING_SNAKE values	enum UserRole { CUSTOMER = 'CUSTOMER' }
Files	kebab-case	booking-form.tsx
Constants	SCREAMING_SNAKE	MAX_PASSENGERS
API endpoints	kebab-case	/api/pricing-rules
Foreign keys	suffix _id	user_id, operator_id
Booleans	prefix is_ or has_	is_active, has_wheelchair_access
Timestamps	suffix _at	created_at, completed_at
4. DATABASE SCHEMA
Enums

UserRole: CUSTOMER | OPERATOR | ADMIN
OperatorApprovalStatus: PENDING | APPROVED | REJECTED | SUSPENDED
BookingStatus: PENDING_PAYMENT | PAID | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED | REFUNDED
JobStatus: OPEN_FOR_BIDDING | BIDDING_CLOSED | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED | NO_BIDS_RECEIVED
BidStatus: PENDING | WON | LOST | WITHDRAWN
VehicleType: SALOON | ESTATE | MPV | EXECUTIVE | MINIBUS
ServiceType: AIRPORT_PICKUP | AIRPORT_DROPOFF | POINT_TO_POINT
TransactionType: CUSTOMER_PAYMENT | OPERATOR_PAYOUT | REFUND | PLATFORM_COMMISSION
TransactionStatus: PENDING | COMPLETED | FAILED | CANCELLED
NotificationType: EMAIL | SMS
NotificationStatus: PENDING | SENT | FAILED | BOUNCED
Models & Relationships
User (table: users)
id (UUID PK), email (unique), password_hash, role, first_name, last_name, phone_number, is_email_verified, is_active, created_at, updated_at
Relations: → Booking[], → OperatorProfile?, → Notification[]
OperatorProfile (table: operator_profiles)
id, user_id (unique FK), company_name, registration_number (unique), vat_number, approval_status, reputation_score (Decimal 0.00-5.00), bank_account_name, bank_account_number, bank_sort_code, timestamps
Relations: ← User, → Vehicle[], → ServiceArea[], → Document[], → Bid[]
Vehicle (table: vehicles)
id, operator_id (FK), vehicle_type, make, model, registration (unique), year, color, passenger_capacity, luggage_capacity, is_active, timestamps
ServiceArea (table: service_areas)
id, operator_id (FK), postcode_prefix, region_name, created_at
Document (table: documents)
id, operator_id (FK), document_type, file_url, file_name, file_size, uploaded_at
Booking (table: bookings)
id, booking_reference (unique), customer_id (FK), status
Journey: service_type, pickup_address, pickup_postcode, pickup_lat/lng, dropoff_address, dropoff_postcode, dropoff_lat/lng, pickup_datetime
Details: passenger_count, luggage_count, vehicle_type, flight_number (TEXT), terminal, has_meet_and_greet, special_requirements (JSON), via_points (JSON)
Pricing: distance_miles, duration_minutes, quoted_price (immutable after payment), is_return_journey, return_booking_id
Customer: customer_name, customer_email, customer_phone
Timestamps: created_at, updated_at, completed_at, cancelled_at
Relations: ← User, → Job?, → Transaction[], ↔ Booking (return journey)
Job (table: jobs)
id, booking_id (unique FK), status
Bidding: bidding_window_opens_at, bidding_window_closes_at, bidding_window_duration_hours
Winner: winning_bid_id (unique FK), platform_margin, assigned_at
Timestamps: created_at, updated_at, completed_at
Relations: ← Booking, → Bid[], → Bid? (winning), → DriverDetails?
Bid (table: bids)
id, job_id (FK), operator_id (FK), bid_amount, status, notes, timestamps
Constraint: @@unique([job_id, operator_id]) (one bid per operator per job)
Relations: ← Job, ← OperatorProfile, → Job? (if won)
DriverDetails (table: driver_details)
id, job_id (unique FK), driver_name, driver_phone, vehicle_registration, vehicle_make, vehicle_model, vehicle_color, timestamps
Transaction (table: transactions)
id, booking_id (FK), type, status, amount, currency (default "GBP"), stripe_transaction_id (unique), stripe_payment_intent_id (unique), description, metadata (JSON), timestamps
PricingRule (table: pricing_rules)
id, rule_type, vehicle_type, base_amount, percentage, start_time, end_time, start_date, end_date, airport_code, is_active, timestamps
Notification (table: notifications)
id, user_id (FK), type, status, recipient_email, recipient_phone, subject, message, template_id, metadata (JSON), sent_at, failed_at, error_message, created_at
Key Business Rules
Bid amount must be ≤ booking.quoted_price and > 0
Winner selection: lowest bid wins, tiebreaker = reputation_score
Status flow: PENDING_PAYMENT → PAID → ASSIGNED → IN_PROGRESS → COMPLETED
No bids received → escalate to admin
Platform margin = Customer Price - Winning Bid
5. API SPECIFICATION
Response Format
Success:

{ "success": true, "data": {...}, "meta": { "page", "limit", "total", "totalPages" } }
Error:

{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
Authentication
JWT-based (Bearer token in Authorization header or httpOnly cookie)
Access token expires in 7 days
Public endpoints: /auth/register, /auth/login, /auth/forgot-password, /auth/reset-password, /health
RBAC
Role	Permissions
CUSTOMER	Create bookings, view own bookings, make payments
OPERATOR	View jobs (in service area), submit bids, manage assigned jobs, view earnings
ADMIN	Full access
Endpoints Summary
Auth
POST /auth/register - Register (public)
POST /auth/login - Login (public)
POST /auth/logout - Logout
GET /auth/me - Current user
POST /auth/forgot-password - Request reset (public, always returns 200)
POST /auth/reset-password - Reset with token (public)
Bookings
POST /bookings/quote - Calculate quote (optional auth)
POST /bookings - Create booking (CUSTOMER) → returns payment_intent.client_secret
GET /bookings - List own bookings
GET /bookings/:id - Get booking details
PATCH /bookings/:id - Update (only PENDING_PAYMENT or PAID status)
DELETE /bookings/:id - Cancel + refund
Jobs
GET /jobs - Available jobs for operator (filtered by service area/vehicle types, APPROVED operators only)
GET /jobs/:id - Job details with bids
Bids
POST /jobs/:jobId/bids - Submit bid (OPERATOR, APPROVED only)
GET /bids - Operator's bids
DELETE /bids/:id - Withdraw bid (before window closes)
Operators
GET /operators/dashboard - Stats, recent jobs, pending payouts
POST /operators/jobs/:jobId/driver-details - Submit driver details (won jobs only)
PATCH /operators/profile - Update profile
POST /operators/vehicles - Add vehicle
POST /operators/documents - Upload document (multipart, max 5MB, PDF/JPG/PNG)
Payments
POST /payments/create-payment-intent - Create Stripe PaymentIntent
POST /payments/webhook - Stripe webhook (signature verified)
Admin
GET /admin/dashboard - KPIs, alerts
GET /admin/operators - List operators with filters
PATCH /admin/operators/:id/approval - Approve/reject/suspend
GET /admin/bookings - All bookings
POST /admin/jobs/:jobId/assign - Manual assignment
GET /admin/pricing-rules - List pricing rules
POST /admin/pricing-rules - Create rule
PATCH /admin/pricing-rules/:id - Update rule
DELETE /admin/pricing-rules/:id - Delete rule
POST /admin/bookings/:id/refund - Process refund
Webhook Events (Stripe)
payment_intent.succeeded → Booking PAID, create Job, broadcast to operators
payment_intent.payment_failed → Log failure, notify customer
charge.refunded → Create REFUND transaction, update booking status
6. DESIGN STANDARDS
Mobile-first (320px minimum), responsive breakpoints: sm(640), md(768), lg(1024), xl(1280), 2xl(1536)
NO hardcoded pixels (w-[900px]), use Tailwind theme values
All colors in tailwind.config.ts theme.extend.colors
Touch targets: minimum 44x44px
Base font: 16px minimum on mobile
WCAG 2.1 AA compliance
100% original design (no copying ots-uk.co.uk)
7. HTTP STATUS CODES
200: Success (GET, PATCH, PUT)
201: Created (POST)
204: No Content (DELETE)
400: Bad Request (validation)
401: Unauthorized
403: Forbidden
404: Not Found
409: Conflict (duplicate)
422: Unprocessable Entity (business rule violation)
500: Internal Server Error
8. VEHICLE TYPES
Type	Passengers	Luggage
SALOON	1-4	2 large, 2 hand
ESTATE	1-4	4 large, 2 hand
MPV	5-6	4 large, 4 hand
EXECUTIVE	1-4	2 large, 2 hand
MINIBUS	7-16	10+ large
9. PRICING COMPONENTS
Base fare (by vehicle type)
Per-mile rate
Time surcharges (night 22:00-06:00, peak hours)
Holiday surcharges (Christmas/New Year = 50%)
Airport fees (by airport code)
Meet & Greet add-on
Return journey discount: 5%
This summary is the canonical source of truth. All implementation must conform to these specifications.