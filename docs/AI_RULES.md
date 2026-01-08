# Strict Scope Control Rules for AI Development

When working on this project, the AI assistant MUST adhere to these rules:

---

## Prohibited Actions

### ✋ NO Feature Suggestions

- **NO feature suggestions** beyond the defined scope during development
- Stick to features defined in [FEATURES.md](./FEATURES.md)
- Don't suggest "nice to have" features unless explicitly asked

### ✋ NO "Nice to Have" Additions

- **NO "nice to have" additions** or enhancements unless explicitly requested
- If you think something might be useful, ask the user first
- Don't add features "just in case"

### ✋ NO Future-Proofing

- **NO future-proofing** beyond current requirements
- Don't add fields "for future use"
- Don't add unused columns, tables, or API endpoints
- Implement only what's needed NOW for MVP

### ✋ NO Over-Engineering

- **NO over-engineering** - implement the simplest solution that meets requirements
- Don't create complex abstractions for simple problems
- KISS principle: Keep It Simple, Stupid
- YAGNI principle: You Aren't Gonna Need It

### ✋ NO Copying

- **NO copying** ots-uk.co.uk design, layout, colors, or content (copyright risk)
- Don't replicate their UI patterns, color schemes, or text
- Use them ONLY as functional reference

---

## Required Actions

### ✅ Flight Number Field

- **Flight number field** should be collected and stored as plain text only (VARCHAR/TEXT)
- NO API integration for flight tracking
- NO validation beyond basic format checking
- Just store it as text for operator reference

### ✅ Focus Exclusively on MVP

- **Focus exclusively** on delivering the defined MVP features
- Complete one feature fully before moving to the next
- Prioritize working code over perfect code

### ✅ Explicit Approval for Changes

- **Any scope changes** must be explicitly approved by the user and documented in this file
- Don't assume what the user wants
- Ask questions when requirements are unclear

### ✅ Ask When in Doubt

- **When in doubt**, ask the user rather than making assumptions or adding features
- Better to ask and get clarity than to build the wrong thing
- User input is valuable feedback

### ✅ Prioritize Completion

- **Prioritize completion** over perfection
- Working MVP is better than incomplete feature-rich application
- Ship working code, iterate based on feedback

### ✅ Use ots-uk.co.uk as Reference Only

- **Use ots-uk.co.uk ONLY as functional reference**
- Study how their features work, not how they look
- Understand the user flow, not copy the UI

### ✅ Create Original Design

- **Create 100% original design** and copywriting
- Unique color palette, typography, layout
- Original marketing copy and content
- Different UI patterns and components

---

## Development Guidelines

### Code Quality Over Quantity

```typescript
// ✅ CORRECT - Simple, clear, working code
async findAvailableJobs(operatorId: string) {
  return this.prisma.job.findMany({
    where: {
      status: 'OPEN',
      operatorId: null,
    },
  });
}

// ❌ INCORRECT - Over-engineered with unused features
async findAvailableJobs(
  operatorId: string,
  options?: {
    includeArchived?: boolean; // Not needed for MVP
    futureProofFilter?: string; // Not needed for MVP
    customSortOrder?: 'asc' | 'desc'; // Not needed for MVP
  }
) {
  // Over-complicated implementation
}
```

### Scope Discipline Examples

#### ✅ CORRECT: In Scope

```typescript
// Customer can book transfer with basic details
async createBooking(dto: CreateBookingDto) {
  return this.bookingsService.create(dto);
}
```

#### ❌ INCORRECT: Out of Scope

```typescript
// ❌ Don't add loyalty points (not in MVP)
async createBooking(dto: CreateBookingDto) {
  const booking = await this.bookingsService.create(dto);

  // ❌ This is out of scope!
  await this.loyaltyService.awardPoints(booking.customerId, 100);

  return booking;
}
```

#### ✅ CORRECT: Ask First

```typescript
// If you think something is missing, ask:
// "Should we add email verification during registration?
//  I noticed it's not explicitly mentioned in FEATURES.md."
```

---

## Communication Guidelines

### When Implementing Features

**✅ DO:**
- Confirm understanding of requirements before starting
- Break down complex features into smaller tasks
- Update user on progress
- Ask for clarification when requirements are ambiguous

**❌ DON'T:**
- Assume what the user wants
- Add features not explicitly requested
- Make architectural decisions without discussion
- Suggest features during implementation

### Example Good Communication

```
User: "Add login functionality"

AI: "I'll implement login with the following:
1. Email/password authentication using Passport.js JWT
2. Zod validation for email and password
3. bcrypt password hashing
4. POST /auth/login endpoint

Should I also add rate limiting to prevent brute force attacks?
(This is mentioned in CODE_STANDARDS.md line 1134)"

User: "Yes, add rate limiting"

AI: "Perfect! I'll add @nestjs/throttler with 5 requests per minute limit."
```

### Example Bad Communication

```
User: "Add login functionality"

AI: "I've added login with these features:
1. Email/password login ✅
2. Social login (Google, Facebook) ❌ (not requested)
3. Two-factor authentication ❌ (not requested)
4. Remember me for 30 days ❌ (not requested)
5. Login activity tracking ❌ (not requested)"

This is WRONG - too many unrequested features!
```

---

## Checklist for Every Task

Before implementing ANY feature, ask yourself:

- [ ] Is this feature explicitly listed in FEATURES.md?
- [ ] Am I implementing the SIMPLEST solution that works?
- [ ] Am I adding any "future-proofing" that's not needed now?
- [ ] Am I copying any design/content from ots-uk.co.uk?
- [ ] Have I asked the user for clarification if anything is unclear?
- [ ] Am I following the code standards in CODE_STANDARDS.md?
- [ ] Am I using the tech stack defined in ARCHITECTURE.md?

If you answer "NO" to any of these questions, STOP and reconsider your approach.

---

## Examples of Scope Creep (Avoid These!)

### ❌ Example 1: Over-Engineering

```typescript
// User asked: "Store booking reference"

// ❌ WRONG - Too complex for MVP
class BookingReferenceGenerator {
  private readonly prefix: string;
  private readonly algorithm: 'uuid' | 'nanoid' | 'custom';
  private readonly customPattern?: RegExp;

  constructor(config: ReferenceConfig) {
    // 50 lines of configuration logic...
  }

  generate(): string {
    // Complex generation with checksums, validation, etc.
  }
}

// ✅ CORRECT - Simple, works for MVP
function generateBookingReference(): string {
  return `BK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}
```

### ❌ Example 2: Adding Unrequested Features

```typescript
// User asked: "Create operator registration"

// ❌ WRONG - Added analytics not in scope
@Post('register')
async registerOperator(@Body() dto: RegisterOperatorDto) {
  const operator = await this.operatorsService.create(dto);

  // ❌ Not requested!
  await this.analyticsService.track('operator_registered', {
    operatorId: operator.id,
    source: 'direct',
    campaign: dto.referralCode,
  });

  // ❌ Not requested!
  await this.marketingService.addToEmailList(operator.email);

  return operator;
}

// ✅ CORRECT - Just what was requested
@Post('register')
async registerOperator(@Body() dto: RegisterOperatorDto) {
  return this.operatorsService.create(dto);
}
```

### ❌ Example 3: Future-Proofing

```prisma
// User asked: "Create booking table"

// ❌ WRONG - Added fields for future features
model Booking {
  id                String   @id @default(uuid())
  pickupLocation    String
  dropoffLocation   String
  status            BookingStatus

  // ❌ Not needed for MVP
  loyaltyPointsEarned Int?
  referralCode      String?
  corporateAccountId String?
  recurringBookingId String?
  subscriptionTier  String?
}

// ✅ CORRECT - Only MVP fields
model Booking {
  id              String   @id @default(uuid())
  pickupLocation  String
  dropoffLocation String
  status          BookingStatus
  customerId      String
  // ... only MVP fields
}
```

---

## Summary

**The Golden Rule:** If it's not explicitly in FEATURES.md, don't build it without asking first.

**Remember:**
- MVP means Minimum VIABLE Product, not Maximum
- Working simple code > Perfect complex code
- User feedback > Your assumptions
- Ask > Assume
- Ship > Perfect

**When in doubt, ask the user!**
