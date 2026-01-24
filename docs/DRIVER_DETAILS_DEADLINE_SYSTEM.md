# Driver Details Deadline & Reminder System

**Status:** Planned
**Priority:** Medium
**Created:** 2026-01-10

---

## Overview

This document outlines the implementation plan for enforcing driver details submission deadlines and automated reminder notifications to operators after they win a bid.

### Problem Statement

Currently, after an operator wins a bid, there's no enforcement mechanism to ensure they submit driver details in a timely manner. This can lead to:
- Customers not receiving driver information before pickup
- Operators winning bids without having drivers available
- Manual admin intervention required to follow up

### Proposed Solution

Implement a deadline-based system with automated reminders:
1. Calculate deadline when job is assigned
2. Schedule automated reminder notifications
3. Escalate to admin if deadline is missed
4. Optionally auto-reassign to next lowest bidder

---

## Current State Analysis

### ✅ What Already Exists

| Component | Status | Details |
|-----------|--------|---------|
| Job Schema | ✅ | Has `biddingWindowClosesAt` but NO deadline field |
| JobStatus Enum | ✅ | `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, etc. |
| DriverDetails Model | ✅ | Stores driver info after submission |
| BullMQ Queue System | ✅ | `BiddingQueueService` for scheduled jobs |
| NotificationsService | ✅ | Has `sendBidWonNotification()`, NO reminder methods |
| SystemSettings | ✅ | Configurable bidding window hours |

### ❌ What's Missing

| Missing Component | Required For |
|-------------------|--------------|
| `driverDetailsDeadline` field on Job | Track when driver details must be submitted |
| `driverDetailsSubmittedAt` field on Job | Track if/when details were submitted |
| Reminder queue job type | Schedule automated reminders |
| Escalation queue job type | Auto-escalate if deadline missed |
| `sendDriverDetailsReminder()` method | Send reminder notifications to operators |
| System settings for reminder timing | Configure hours before deadline |

---

## Schema Changes Required

```prisma
model Job {
  // ... existing fields ...

  // NEW: Driver details deadline tracking
  driverDetailsDeadline     DateTime?   // When driver details must be submitted
  driverDetailsSubmittedAt  DateTime?   // When details were actually submitted

  // ... rest of model ...
}
```

**Rationale:**
- `driverDetailsDeadline`: Calculated when job is assigned (e.g., pickup time - 24h OR assigned time + X hours)
- `driverDetailsSubmittedAt`: Audit trail + prevents duplicate reminders

---

## System Settings to Add

| Key | Default | Type | Description |
|-----|---------|------|-------------|
| `DRIVER_DETAILS_DEADLINE_HOURS` | `24` | NUMBER | Hours before pickup that driver details are required |
| `DRIVER_DETAILS_MIN_DEADLINE_HOURS` | `6` | NUMBER | Minimum deadline for short-notice bookings |
| `DRIVER_DETAILS_REMINDER_HOURS_BEFORE` | `6` | NUMBER | Hours before deadline to send first reminder |
| `DRIVER_DETAILS_FINAL_REMINDER_HOURS` | `2` | NUMBER | Hours before deadline for final reminder |
| `AUTO_ESCALATE_ON_MISSED_DEADLINE` | `true` | BOOLEAN | Escalate to admin if deadline missed |

---

## Automated Reminders Workflow

```
JOB ASSIGNED TO OPERATOR
         │
         ▼
┌─────────────────────────────────────────┐
│  Calculate driverDetailsDeadline:       │
│  MIN(pickupTime - 24h, assignedTime + 6h)│
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Schedule BullMQ Jobs:                  │
│  1. First Reminder (deadline - 6h)      │
│  2. Final Reminder (deadline - 2h)      │
│  3. Deadline Check (at deadline)        │
└─────────────────────────────────────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
[1st Rem] [Final Rem] [Deadline]
    │         │            │
    ▼         ▼            ▼
Check if  Check if    Check if
submitted submitted   submitted
    │         │            │
  ┌─┴─┐     ┌─┴─┐       ┌─┴─┐
 Yes  No   Yes  No     Yes  No
  │   │     │   │       │   │


---

## Implementation Components

### 1. New Queue Job Types

```typescript
// In BiddingQueueService or new DriverDetailsQueueService
type DriverDetailsJobType =
  | 'driver-details-reminder'       // First reminder
  | 'driver-details-final-reminder' // Urgent reminder
  | 'driver-details-deadline';      // Deadline check/escalation

interface DriverDetailsJobData {
  jobId: string;
  operatorId: string;
  bookingReference: string;
  reminderType: 'FIRST' | 'FINAL' | 'DEADLINE';
}
```

### 2. New Processor: `DriverDetailsProcessor`

Handles the three scheduled events:
- Check if `driverDetailsSubmittedAt` is set
- If not submitted: send notification or escalate
- If submitted: skip (no-op)

### 3. New Notification Methods

```typescript
// In NotificationsService
sendDriverDetailsReminder(data: {
  operatorId: string;
  bookingReference: string;
  pickupDatetime: Date;
  deadlineTime: Date;
  reminderType: 'FIRST' | 'FINAL';
}): Promise<void>

sendDriverDetailsMissedDeadline(data: {
  operatorId: string;
  bookingReference: string;
  adminEmail: string;
}): Promise<void>
```

### 4. Trigger Points

| Event | Action |
|-------|--------|
| Job assigned (auto or manual) | Calculate deadline, schedule reminders |
| Driver details submitted | Cancel remaining reminders, set `driverDetailsSubmittedAt` |
| Admin reassigns job | Cancel old reminders, schedule new ones |

---

## Files to Modify/Create

| Category | File | Changes |
|----------|------|---------|
| Schema | `prisma/schema.prisma` | Add 2 fields to `Job` model |
| Migration | `prisma/migrations/` | New migration for schema changes |
| Seed Data | `prisma/seed.ts` | Add 5 new system settings |
| Queue Service | `src/queue/bidding-queue.service.ts` | Add reminder scheduling methods |
| New Processor | `src/queue/driver-details.processor.ts` | Create new processor |
| Queue Module | `src/queue/bidding-queue.module.ts` | Register new processor |
| Notifications | `src/integrations/notifications/notifications.service.ts` | Add 2 new methods |
| Bidding Processor | `src/queue/bidding.processor.ts` | Schedule reminders after winner assigned |
| Admin Service | `src/modules/admin/admin.service.ts` | Schedule reminders after manual assignment |
| Jobs Controller | `src/modules/jobs/jobs.controller.ts` | Cancel reminders when details submitted |

---

## Implementation Phases

### Phase 1: Schema + Settings
- Add schema fields
- Run migration
- Add system settings to seed

### Phase 2: Scheduling Infrastructure
- Add queue job types and methods
- Create `DriverDetailsProcessor`

### Phase 3: Reminder Notifications
- Add notification service methods
- Add email/SMS templates

### Phase 4: Integration
- Trigger scheduling on job assignment (auto + manual)
- Cancel reminders when details submitted

### Phase 5: Escalation
- Admin notification when deadline missed
- Optional: Auto-reassignment to next bidder

---

## Notes

- This feature was analyzed on 2026-01-10
- Decision made to NOT collect driver details during bidding (see conversation for rationale)
- Current flow remains: Bid → Win → Submit Driver Details → Customer Notification
- This system adds accountability without changing the bidding flow

