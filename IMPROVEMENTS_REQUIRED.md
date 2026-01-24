# TTS-API - Required Improvements

## 🔴 0. PAYMENT FLOW WEBHOOK FIX (CRITICAL - DISCOVERED JAN 8, 2026)
**Status:** 📋 Documented - Ready for implementation
**Priority:** P0 - MUST FIX BEFORE PRODUCTION
**Issue:** Payment flow bypasses webhook verification, creates jobs before payment confirmed
**Security Risk:** HIGH - Vulnerable to payment fraud
**Documentation:** See `PAYMENT_FLOW_BUG_FIX.md`

**Two-Phase Fix:**
- **Phase 1 (Backend):** Move job creation to webhook handler, add duplicate prevention
- **Phase 2 (Frontend):** Implement polling instead of calling `/payments/confirm`

**Estimated Time:** 17 hours total (6.5h backend + 6.5h frontend + 4h testing/deployment)

---

## 1. DUPLICATE BOOKING PREVENTION
**Status:** Not implemented
**Required:** Add validation before booking creation to check for existing bookings with same:
- Customer ID + Pickup location + Dropoff location + Pickup datetime
- Within 5-minute creation window
- Return appropriate error if duplicate detected

---

## 2. REFUND & CANCELLATION POLICY
**Status:** Full refunds only, no policy rules  
**Required:**
- Create `CancellationPolicy` table with admin-configurable rules:
  - Time windows (e.g., 48h+, 24-48h, 12-24h, <12h before pickup)
  - Refund percentage per window (e.g., 100%, 75%, 50%, 0%)
  - No-refund cutoff time
- Auto-calculate refund amount based on cancellation time
- Auto-trigger refund on booking cancellation
- Admin CRUD endpoints for cancellation policies

---

## 3. PRICING RULES - FULL CONFIGURATION
**Status:** Only base fare & per-mile configurable; rest hardcoded  
**Required:** Make ALL pricing factors admin-configurable:

| Rule Type | Current | Required |
|-----------|---------|----------|
| Base fare by vehicle | ✅ DB | ✅ Keep |
| Per-mile rate | ✅ DB | ✅ Keep |
| Night surcharge (hours + %) | ❌ Hardcoded | Move to DB |
| Peak time (hours + %) | ❌ Hardcoded | Move to DB |
| Holiday surcharge (dates + %) | ❌ Hardcoded | Move to DB |
| Meet & Greet fee | ❌ Hardcoded | Move to DB |
| Return journey discount % | ❌ Hardcoded | Move to DB |
| Airport fees by airport | ❌ Not implemented | Add to DB |
| Vehicle type multipliers | ❌ Hardcoded | Move to DB |

Update `QuoteService` to fetch all rules from DB instead of hardcoded values.

---

## 4. OPERATOR PAYOUT SYSTEM
**Status:** Manual only  
**Required:**
- Create `PayoutSchedule` config table (weekly/bi-weekly, day of week, minimum amount)
- BullMQ scheduled job for automatic payouts
- Admin configuration endpoints for payout schedule
- Payout history and status tracking
- Stripe Connect integration for automatic transfers (or batch manual processing)

---

## 5. BIDDING SYSTEM ENHANCEMENTS
**Status:** Core works but configuration hardcoded  
**Required:**

### 5.1 Configurable Bidding Window
- Create `BiddingConfig` table with:
  - Default window duration (hours)
  - Urgency rules (e.g., <24h lead time = 2h window, <48h = 4h window)
  - Minimum bid amount rules
- Admin CRUD endpoints for bidding configuration

### 5.2 Admin Notifications for Escalated Jobs
- Send email/SMS to admin when:
  - Job receives no bids within 50% of window time
  - Bidding window closes with zero bids
  - Job remains unassigned for X hours after window close
- Create `AdminAlert` table to log alerts
- Admin can configure alert thresholds

### 5.3 Queue System Verification
- Ensure BullMQ Redis connection is functional
- Add health check endpoint for queue status
- Add retry logic for failed jobs
- Add dead letter queue for failed notifications

---

## 6. IMPLEMENTATION PRIORITY

### Phase 1 - Critical (Booking Flow)
1. Duplicate booking prevention
2. Pricing rules full configuration

### Phase 2 - Business Logic
3. Bidding window configuration
4. Admin alerts for no-bid jobs
5. Queue system health checks

### Phase 3 - Financial
6. Cancellation policy & auto-refund
7. Operator payout automation

---

## 7. DATABASE CHANGES NEEDED

```prisma
// New models to add:

model CancellationPolicy {
  id              String   @id @default(uuid())
  hoursBeforePickup Int    // e.g., 48, 24, 12, 0
  refundPercentage  Int    // e.g., 100, 75, 50, 0
  isActive        Boolean  @default(true)
}

model BiddingConfig {
  id                    String   @id @default(uuid())
  defaultWindowHours    Int      @default(24)
  urgentLeadTimeHours   Int      @default(24)
  urgentWindowHours     Int      @default(2)
  minBidPercentage      Int      @default(50) // min bid as % of customer price
  isActive              Boolean  @default(true)
}

model PayoutSchedule {
  id              String   @id @default(uuid())
  frequency       String   // WEEKLY, BIWEEKLY
  dayOfWeek       Int      // 0-6 (Sunday-Saturday)
  minimumAmount   Decimal
  isActive        Boolean  @default(true)
}

model AdminAlert {
  id          String   @id @default(uuid())
  alertType   String   // NO_BIDS, ESCALATED, etc.
  jobId       String?
  message     String
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

Extend `PricingRule` to support all surcharge types with time ranges and percentages.

