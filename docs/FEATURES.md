# Feature Scope

## ✅ FEATURES TO IMPLEMENT (MVP PHASE)

### 1. Customer Booking Flow

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

---

### 2. Bidding System (Core Feature)

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

---

### 3. Transport Company Portal

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

---

### 4. Admin Panel

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

---

### 5. Payment Processing

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

---

### 6. Google Maps Integration

**APIs Used:**
- **Places API**: Address autocomplete and validation
- **Distance Matrix API**: Distance and duration calculation for quote generation
- **Geocoding API**: Convert addresses to coordinates (lat/lng)

**Implementation Requirements:**
- Proper error handling for API failures
- Caching strategy to minimize API costs (cache common routes for 24 hours)
- Rate limiting awareness
- Fallback for API downtime (use cached data or manual entry)

---

### 7. Notification System

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

---

### 8. Service Types

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

---

### 9. Vehicle Types

| Vehicle Type | Passengers | Luggage | Description |
|--------------|------------|---------|-------------|
| Saloon | 1-4 | 2 large, 2 hand | Standard sedan (e.g., Toyota Prius, VW Passat) |
| Estate | 1-4 | 4 large, 2 hand | Estate car with extra luggage space |
| MPV/People Carrier | 5-6 | 4 large, 4 hand | 7-seater (e.g., Ford Galaxy, VW Sharan) |
| Executive | 1-4 | 2 large, 2 hand | Premium sedan (e.g., Mercedes E-Class, BMW 5 Series) |
| Minibus | 7-16 | 10+ large | Large group transport |

---

### 10. Authentication & Authorization

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

## ❌ FEATURES EXPLICITLY OUT OF SCOPE (DO NOT IMPLEMENT)

### Flight Tracking
- ❌ Flight tracking API integration (AviationStack, FlightAware, OpenSky)
- ❌ Automatic flight status monitoring and polling
- ❌ Auto-adjustment of pickup times based on real-time flight delays/early arrivals
- ❌ Terminal and gate information display from APIs
- ✅ Flight number is collected as TEXT ONLY (no validation, no API calls)

### Driver & Vehicle Management
- ❌ Driver mobile application
- ❌ Real-time GPS tracking of drivers during journey
- ❌ Driver dashboard or driver management interface
- ❌ Vehicle dispatch management system
- ❌ Driver ratings or performance tracking
- ✅ Operators manage their own drivers externally

### Communication Features
- ❌ In-app chat or messaging between customers/operators/drivers
- ❌ Real-time notifications (WebSockets, push notifications)
- ✅ Email and SMS notifications only

### Marketing & Loyalty
- ❌ Customer loyalty programs or points system
- ❌ Referral systems or affiliate programs
- ❌ Promotional codes or discount coupons
- ❌ Dynamic pricing based on demand
- ❌ Surge pricing

### Advanced Features
- ❌ Multi-language support (English only for MVP)
- ❌ Multi-currency support (GBP £ only for MVP)
- ❌ Corporate account management with monthly invoicing
- ❌ Event bookings or group booking management
- ❌ Itinerary management
- ❌ Customer reviews and ratings system (collect data but no public display)
- ❌ Operator public profiles or marketplace browsing
- ❌ Advanced analytics and reporting dashboards
- ❌ Mobile apps (iOS/Android) - web-only for MVP
