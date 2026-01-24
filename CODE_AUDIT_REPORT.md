# Code Audit Report - Schema vs Implementation

**Date:** January 17, 2026
**Auditor:** AI Code Review
**Scope:** Complete codebase audit comparing Prisma schema with API implementation

---

## Executive Summary

This audit identifies **critical gaps** between the database schema definitions and their actual implementation in the API. Many important fields exist in the schema but are not being properly set, validated, or managed through the API endpoints.

### Severity Levels
- 🔴 **CRITICAL**: Security risk or broken functionality
- 🟠 **HIGH**: Important business logic missing
- 🟡 **MEDIUM**: Feature incomplete or inconsistent
- 🔵 **LOW**: Minor improvements needed

---

## 1. USER & AUTHENTICATION MODULE

### 🔴 CRITICAL: Email Verification Not Implemented

**Schema Field:**
```prisma
isEmailVerified Boolean @default(false)  // Line 148
```

**Current Implementation:**
- ❌ Field exists in schema but is NEVER set to `true`
- ❌ No email verification endpoint
- ❌ No email verification token generation
- ❌ Users can login without verifying email

**Impact:**
- Users can register with fake/invalid emails
- No email ownership verification
- Potential spam/abuse risk

**Recommendation:**
```typescript
// src/auth/auth.service.ts - ADD THIS
async sendVerificationEmail(userId: string) {
  const token = generateVerificationToken();
  // Store token in database or Redis
  await sendgridService.sendEmail({
    to: user.email,
    template: 'email-verification',
    data: { verificationLink: `${FRONTEND_URL}/verify/${token}` }
  });
}

async verifyEmail(token: string) {
  // Validate token
  await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true }
  });
}
```

---

### 🟠 HIGH: User Active Status Not Checked

**Schema Field:**
```prisma
isActive Boolean @default(true)  // Line 149
```

**Current Implementation:**
- ❌ Field exists but NEVER checked during login
- ❌ Suspended users can still login
- ❌ No admin endpoint to deactivate users

**Files Affected:**
- `src/auth/auth.service.ts` (line 25-37) - No isActive check in validateUser()

**Recommendation:**
```typescript
// src/auth/auth.service.ts - UPDATE validateUser()
async validateUser(email: string, password: string) {
  const user = await this.usersService.findByEmail(email);
  if (!user) return null;

  // ADD THIS CHECK
  if (!user.isActive) {
    throw new UnauthorizedException('Account has been deactivated');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  // ...
}
```

---

### 🟡 MEDIUM: Password Reset Not Implemented

**Missing Functionality:**
- No password reset request endpoint
- No password reset token management
- No forgot password flow

**Recommendation:**
Add endpoints:
- `POST /auth/forgot-password` - Request reset link
- `POST /auth/reset-password` - Reset with token

---

## 2. OPERATOR MODULE

### 🔴 CRITICAL: Operator Approval Status Not Enforced

**Schema Field:**
```prisma
approvalStatus OperatorApprovalStatus @default(PENDING)  // Line 168
```

**Current Implementation:**
- ✅ Set to PENDING on registration (operators.service.ts:35)
- ❌ **PENDING operators can still submit bids!**
- ❌ No check for `approvalStatus === 'APPROVED'` before bidding
- ❌ SUSPENDED operators can still access system

**Impact:**
- Unapproved/suspended operators can bid on jobs
- Business risk - unvetted operators getting jobs

**Files Affected:**
- `src/modules/bids/bids.service.ts` - No approval check
- `src/modules/operators/operators.service.ts:getDashboard()` - Shows jobs to PENDING operators

**Recommendation:**
```typescript
// src/modules/bids/bids.service.ts - ADD THIS CHECK
async createBid(operatorId: string, jobId: string, bidAmount: number) {
  const operator = await prisma.operatorProfile.findUnique({
    where: { id: operatorId }
  });

  // ADD THIS CRITICAL CHECK
  if (operator.approvalStatus !== 'APPROVED') {
    throw new ForbiddenException(
      'Your operator account must be approved before you can submit bids'
    );
  }

  // Rest of bid logic...
}
```

---

### 🟠 HIGH: Reputation Score Never Updated

**Schema Fields:**
```prisma
reputationScore Decimal @default(5.0)  // Line 169
totalJobs Int @default(0)             // Line 170
completedJobs Int @default(0)         // Line 171
```

**Current Implementation:**
- ✅ Fields exist with defaults
- ❌ `totalJobs` never incremented when job assigned
- ❌ `completedJobs` never incremented when job completed
- ❌ `reputationScore` never recalculated

**Impact:**
- Tiebreaker logic in bidding system won't work (docs say "operator reputation score")
- No way to track operator performance

**Recommendation:**
```typescript
// src/modules/jobs/jobs.service.ts - ADD THIS
async markJobCompleted(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { assignedOperator: true }
  });

  // Update job status
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', completedAt: new Date() }
  });

  // UPDATE OPERATOR STATS
  await prisma.operatorProfile.update({
    where: { id: job.assignedOperatorId },
    data: {
      completedJobs: { increment: 1 },
      // Recalculate reputation based on completion rate
    }
  });
}
```

---

### 🟠 HIGH: Bank Details Not Validated

**Schema Fields:**
```prisma
bankAccountName String?   // Line 177
bankAccountNumber String? // Line 178
bankSortCode String?      // Line 179
```

**Current Implementation:**
- ✅ Can be updated (operators.service.ts:157-174)
- ❌ No validation for UK bank account format
- ❌ No validation for sort code format (XX-XX-XX)
- ❌ Can submit invalid bank details

**Recommendation:**
```typescript
// src/modules/operators/dto/update-bank-details.dto.ts
export const UpdateBankDetailsSchema = z.object({
  bankAccountName: z.string().min(1),
  bankAccountNumber: z.string().regex(/^\d{8}$/, 'Must be 8 digits'),
  bankSortCode: z.string().regex(/^\d{2}-\d{2}-\d{2}$/, 'Must be XX-XX-XX format'),
});
```

---

### 🟡 MEDIUM: Compliance Fields Not Collected

**Schema Fields:**
```prisma
operatingLicenseNumber String?  // Line 182
councilRegistration String?     // Line 183
businessAddress String?         // Line 184
businessPostcode String?        // Line 185
emergencyContactName String?    // Line 186
emergencyContactPhone String?   // Line 187
fleetSize Int?                  // Line 188
```

**Current Implementation:**
- ✅ Fields exist in schema
- ✅ Collected during registration (operators.service.ts:39-45)
- ❓ Not clear if these are validated or required for approval

**Recommendation:**
- Consider making some fields required for approval
- Add admin UI to view these during approval process

---

## 3. BOOKING MODULE

### 🟡 MEDIUM: Amendment Tracking Implemented But Not Exposed

**Schema Fields:**
```prisma
amendedAt DateTime?            // Line 352
amendmentFee Decimal?          // Line 353
originalPrice Decimal?         // Line 354
```

**Current Implementation:**
- ✅ Amendment fee logic exists (bookings.service.ts:909-954)
- ❌ Not called by any controller endpoint
- ❌ Frontend can't trigger amendments

**Recommendation:**
```typescript
// src/modules/bookings/bookings.controller.ts - ADD THIS
@Patch(':id/amend')
async amendBooking(
  @Param('id') id: string,
  @Body() dto: UpdateBookingDto
) {
  // Update booking details
  await bookingsService.update(id, dto);

  // Apply amendment fee
  const result = await bookingsService.applyAmendmentFee(id, true);

  return { success: true, data: result };
}
```

---

### 🟡 MEDIUM: Waiting Time Tracking Incomplete

**Schema Fields:**
```prisma
driverArrivedAt DateTime?     // Line 337
passengerPickedUpAt DateTime? // Line 338
waitingCharges Decimal?       // Line 339
```

**Current Implementation:**
- ✅ Methods exist (bookings.service.ts:829-900)
- ❌ No controller endpoints
- ❌ No way for operators to call these

**Recommendation:**
Add operator endpoints:
- `POST /operators/jobs/:jobId/mark-arrival`
- `POST /operators/jobs/:jobId/mark-pickup`

---

### 🟠 HIGH: No-Show Tracking Missing Controller Endpoint

**Schema Fields:**
```prisma
markedNoShowAt DateTime?   // Line 348
noShowCharges Decimal?     // Line 349
```

**Current Implementation:**
- ✅ Service method exists (bookings.service.ts:788-820)
- ❌ Not exposed via API
- ❌ Operators can't mark no-shows

**Recommendation:**
```typescript
// src/modules/bookings/bookings.controller.ts - ADD THIS
@Post(':id/mark-no-show')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR', 'ADMIN')
async markNoShow(@Param('id') id: string) {
  const booking = await bookingsService.markAsNoShow(id);
  return { success: true, data: booking };
}
```

---

## 4. JOB & BIDDING MODULE

### 🔴 CRITICAL: Payout Status Never Updated

**Schema Fields:**
```prisma
payoutStatus PayoutStatus @default(NOT_ELIGIBLE)  // Line 395
payoutEligibleAt DateTime?                       // Line 396
payoutProcessedAt DateTime?                      // Line 397
payoutTransactionId String?                      // Line 398
```

**Current Implementation:**
- ✅ Fields exist in schema
- ❌ `payoutStatus` NEVER changes from NOT_ELIGIBLE
- ❌ `payoutEligibleAt` NEVER set
- ❌ No cron job or logic to update payout status

**Impact:**
- Operators never get paid
- Payout system is completely non-functional

**Recommendation:**
```typescript
// src/queue/payout.processor.ts - CREATE THIS
@Processor('payout-queue')
export class PayoutProcessor {
  @Cron('0 */6 * * *') // Every 6 hours
  async checkEligiblePayouts() {
    const completedJobs = await prisma.job.findMany({
      where: {
        status: 'COMPLETED',
        payoutStatus: 'NOT_ELIGIBLE',
        completedAt: {
          lte: new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
        }
      }
    });

    for (const job of completedJobs) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          payoutStatus: 'PENDING',
          payoutEligibleAt: new Date()
        }
      });
    }
  }
}
```

---

### 🟠 HIGH: Platform Margin Not Calculated on Assignment

**Schema Field:**
```prisma
platformMargin Decimal?  // Line 392
```

**Current Implementation:**
- ✅ Calculated when operator accepts (operators.service.ts:296-298)
- ❓ Not clear if this happens in all assignment scenarios
- ❌ No admin view of total platform margins/revenue

**Recommendation:**
- Add admin endpoint: `GET /admin/financial-stats`
- Show total platform margin, revenue by period

---

## 5. TRANSACTION & PAYMENT MODULE

### 🟡 MEDIUM: Transaction Status Transitions Not Managed

**Schema Field:**
```prisma
status TransactionStatus @default(PENDING)  // Line 473
completedAt DateTime?                       // Line 476
```

**Current Implementation:**
- ❓ Need to audit stripe webhook handler
- ❓ Check if transactions are properly updated on payment success/failure

**Recommendation:**
Review `src/integrations/stripe/stripe-webhook.controller.ts` for proper status updates.

---

## 6. DOCUMENT MANAGEMENT

### 🟡 MEDIUM: Document Expiry Not Monitored

**Schema Field:**
```prisma
expiresAt DateTime?  // Line 243 (Document model)
```

**Current Implementation:**
- ✅ Field collected
- ❌ No cron job to check expired documents
- ❌ No notification when documents expire
- ❌ Operators with expired insurance can still work

**Recommendation:**
```typescript
// src/queue/document-expiry.processor.ts - CREATE THIS
@Cron('0 0 * * *') // Daily at midnight
async checkExpiredDocuments() {
  const expiredDocs = await prisma.document.findMany({
    where: {
      expiresAt: { lte: new Date() },
      documentType: { in: ['INSURANCE', 'OPERATING_LICENSE'] }
    },
    include: { operator: true }
  });

  for (const doc of expiredDocs) {
    // Suspend operator
    await prisma.operatorProfile.update({
      where: { id: doc.operatorId },
      data: { approvalStatus: 'SUSPENDED' }
    });

    // Notify operator
    await notificationsService.sendDocumentExpiry(doc);
  }
}
```

---

## 7. NOTIFICATION MODULE

### 🟡 MEDIUM: Notification Status Not Tracked Properly

**Schema Fields:**
```prisma
status NotificationStatus @default(PENDING)  // Line 520
sentAt DateTime?                             // Line 521
failedAt DateTime?                           // Line 522
errorMessage String?                         // Line 523
```

**Current Implementation:**
- ❓ Need to verify if SendGrid/Twilio services update these fields
- ❓ Check retry logic for failed notifications

---

## SUMMARY OF CRITICAL ACTIONS REQUIRED

### Immediate (Fix This Week)
1. ✅ **Add rate limiting** - COMPLETED
2. 🔴 **Enforce operator approval status before bidding**
3. 🔴 **Implement payout status update logic**
4. 🔴 **Add isActive check in login**
5. 🟠 **Update operator stats (totalJobs, completedJobs) on job completion**

### High Priority (Next Sprint)
6. 🟠 **Implement email verification flow**
7. 🟠 **Validate bank details format**
8. 🟠 **Expose no-show marking endpoint**
9. 🟠 **Create document expiry monitoring**

### Medium Priority (Backlog)
10. 🟡 **Add amendment endpoints**
11. 🟡 **Add waiting time tracking endpoints**
12. 🟡 **Add password reset flow**
13. 🟡 **Create admin financial reports**

---

## FILES TO CREATE

1. `src/queue/payout.processor.ts` - Payout eligibility checker
2. `src/queue/document-expiry.processor.ts` - Document expiry monitor
3. `src/auth/dto/verify-email.dto.ts` - Email verification
4. `src/auth/dto/reset-password.dto.ts` - Password reset

---

## FILES TO UPDATE

1. `src/auth/auth.service.ts` - Add isActive + isEmailVerified checks
2. `src/modules/bids/bids.service.ts` - Add approval status check
3. `src/modules/jobs/jobs.service.ts` - Update operator stats on completion
4. `src/modules/bookings/bookings.controller.ts` - Add amendment/no-show endpoints
5. `src/modules/operators/dto/update-bank-details.dto.ts` - Add validation

---

**End of Audit Report**
