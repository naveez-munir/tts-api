# Backend Operator Profile & Document Management Audit Report
**Date:** 2026-01-20
**Scope:** Backend API, Database Schema, DTOs, Controllers, and Services
**Repository:** `/Users/macbookpro/Desktop/Traning/Next Js/tts-api/`

---

## Executive Summary

This audit examines the backend implementation for operator profile management, document handling, vehicle management, and service area management.

### ✅ FIXES COMPLETED (2026-01-20)

**Critical Security Issues:** ~~2~~ → **0 (ALL FIXED)** ✅
**Compliance Issues:** ~~1~~ → **0 (FIXED)** ✅
**Missing Implementations:** 2 (Vehicle & Service Area management - not in scope)
**Warnings:** 1 (Profile lookup - low priority)

### 🎯 What Was Fixed:
1. ✅ **Created UpdateOperatorProfileDto** - Field whitelisting with Zod validation
2. ✅ **Fixed PATCH /operators/profile** - Now uses validation and userId authorization
3. ✅ **Added PATCH /operators/bank-details** - Dedicated endpoint with validation
4. ✅ **Fixed getDocuments()** - Now returns `expiresAt` field

### 📝 Frontend Team Action Required:
- Update API calls to use new endpoints (see Section 12)
- Update TypeScript interfaces to match new response formats (see Section 13)

---

## 1. Database Schema Analysis

### 1.1 OperatorProfile Model
**Source:** `prisma/schema.prisma` (lines 30-63)

| Field | Type | Nullable | Default | Protected? | Notes |
|-------|------|----------|---------|------------|-------|
| `id` | String | No | cuid() | ✅ Yes | Primary key |
| `userId` | String | No | - | ✅ Yes | Foreign key, unique |
| `companyName` | String | No | - | ❌ No | Should be editable |
| `registrationNumber` | String | No | - | ✅ Yes | Set at registration only |
| `vatNumber` | String | Yes | null | ❌ No | Should be editable |
| `reputationScore` | Decimal(3,2) | No | 5.0 | ✅ Yes | System-managed |
| `totalJobs` | Int | No | 0 | ✅ Yes | System-managed |
| `completedJobs` | Int | No | 0 | ✅ Yes | System-managed |
| `createdAt` | DateTime | No | now() | ✅ Yes | Auto-generated |
| `updatedAt` | DateTime | No | updatedAt | ✅ Yes | Auto-updated |
| `approvalStatus` | Enum | No | PENDING | ✅ Yes | Admin-only |
| `bankAccountName` | String | Yes | null | ❌ No | Needs dedicated endpoint |
| `bankAccountNumber` | String | Yes | null | ❌ No | Needs dedicated endpoint |
| `bankSortCode` | String | Yes | null | ❌ No | Needs dedicated endpoint |
| `businessAddress` | String | Yes | null | ❌ No | Should be editable |
| `businessPostcode` | String | Yes | null | ❌ No | Should be editable |
| `councilRegistration` | String | Yes | null | ❌ No | Should be editable |
| `emergencyContactName` | String | Yes | null | ❌ No | Should be editable |
| `emergencyContactPhone` | String | Yes | null | ❌ No | Should be editable |
| `fleetSize` | Int | Yes | null | ❌ No | Should be editable |
| `operatingLicenseNumber` | String | Yes | null | ❌ No | Should be editable |
| `vehicleTypes` | VehicleType[] | No | [] | ❌ No | Should be editable |
| `serviceAreas` | ServiceArea[] | No | - | ❌ No | Relation (separate table) |
| `vehicles` | Vehicle[] | No | - | ❌ No | Relation (separate table) |
| `documents` | Document[] | No | - | ✅ Yes | Relation (separate table) |
| `user` | User | No | - | ✅ Yes | Relation |

### 1.2 Document Model
**Source:** `prisma/schema.prisma` (lines 91-102)

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | String | No | cuid() | Primary key |
| `operatorId` | String | No | - | Foreign key |
| `documentType` | DocumentType | No | - | Enum: OPERATING_LICENSE, INSURANCE, OTHER |
| `fileUrl` | String | No | - | S3 key (private) |
| `fileName` | String | No | - | Original filename |
| `uploadedAt` | DateTime | No | now() | Auto-generated |
| `expiresAt` | DateTime | Yes | null | **CRITICAL: Not returned by API** |

### 1.3 Vehicle Model
**Source:** `prisma/schema.prisma` (lines 65-79)

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | String | No | cuid() | Primary key |
| `operatorId` | String | No | - | Foreign key |
| `vehicleType` | VehicleType | No | - | Enum |
| `registrationPlate` | String | No | - | Unique identifier |
| `make` | String | No | - | e.g., "Mercedes" |
| `model` | String | No | - | e.g., "E-Class" |
| `year` | Int | No | - | Manufacturing year |
| `isActive` | Boolean | No | true | Soft delete flag |
| `createdAt` | DateTime | No | now() | Auto-generated |
| `updatedAt` | DateTime | No | updatedAt | Auto-updated |

**Status:** ❌ **NO CRUD ENDPOINTS IMPLEMENTED**

### 1.4 ServiceArea Model
**Source:** `prisma/schema.prisma` (lines 81-89)

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | String | No | cuid() | Primary key |
| `operatorId` | String | No | - | Foreign key |
| `postcode` | String | No | - | Service area postcode |
| `createdAt` | DateTime | No | now() | Auto-generated |

**Status:** ✅ Created during registration, ❌ **NO UPDATE/DELETE ENDPOINTS**

---

## 2. Backend API Endpoints Analysis

### 2.1 Operator Profile Endpoints
**Controller:** `src/modules/operators/operators.controller.ts`

| Endpoint | Method | Auth | Validation | Status |
|----------|--------|------|------------|--------|
| `/operators/register` | POST | ✅ JWT | ✅ RegisterOperatorSchema | ✅ Implemented |
| `/operators/profile/:id` | GET | ✅ JWT | ❌ None | ✅ Implemented |
| `/operators/dashboard` | GET | ✅ JWT | ❌ None | ✅ Implemented |
| `/operators/profile/:id` | PATCH | ✅ JWT | ❌ **NO VALIDATION** | 🔴 **CRITICAL ISSUE** |
| `/operators/documents` | GET | ✅ JWT | ❌ None | ✅ Implemented |
| `/operators/documents/:id` | DELETE | ✅ JWT | ❌ None | ✅ Implemented |
| `/operators/jobs/:ref/accept` | POST | ✅ JWT | ❌ None | ✅ Implemented |
| `/operators/jobs/:ref/decline` | POST | ✅ JWT | ❌ None | ✅ Implemented |
| `/operators/job-offers` | GET | ✅ JWT | ❌ None | ✅ Implemented |

**Missing Endpoints:**
- ❌ `PATCH /operators/bank-details` - Dedicated bank details update
- ❌ `POST /operators/vehicles` - Add vehicle
- ❌ `PATCH /operators/vehicles/:id` - Update vehicle
- ❌ `DELETE /operators/vehicles/:id` - Remove vehicle
- ❌ `POST /operators/service-areas` - Add service area
- ❌ `DELETE /operators/service-areas/:id` - Remove service area

### 2.2 Document Upload Endpoints
**Controller:** `src/integrations/s3/s3.controller.ts`

| Endpoint | Method | Auth | Validation | Status |
|----------|--------|------|------------|--------|
| `/uploads/presigned-url` | POST | ✅ OPERATOR | ✅ GenerateUploadUrlSchema | ✅ Implemented |
| `/uploads/confirm` | POST | ✅ OPERATOR | ✅ ConfirmUploadSchema | ✅ Implemented |
| `/uploads/:id/download-url` | GET | ✅ OPERATOR/ADMIN | ❌ None | ✅ Implemented |

**Document Upload Flow:**
1. ✅ Frontend requests presigned URL
2. ✅ Frontend uploads to S3 directly
3. ✅ Frontend confirms upload with `expiresAt` field
4. ✅ Backend saves document with `expiresAt` to database
5. ❌ **Backend does NOT return `expiresAt` when listing documents**

### 2.3 Admin Operator Management Endpoints
**Controller:** `src/modules/admin/admin.controller.ts`

| Endpoint | Method | Auth | Validation | Status |
|----------|--------|------|------------|--------|
| `/admin/operators` | GET | ✅ ADMIN | ✅ ListOperatorsQuerySchema | ✅ Implemented |
| `/admin/operators/:id/approval` | PATCH | ✅ ADMIN | ✅ OperatorApprovalSchema | ✅ Implemented |

**Approval Logic:**
- ✅ Validates required fields before approval (service areas, documents)
- ✅ Supports APPROVED, REJECTED, SUSPENDED statuses
- ✅ Prevents operators from bidding when suspended

---

## 3. Data Transfer Objects (DTOs) Analysis

### 3.1 Existing DTOs
**Location:** `src/modules/operators/dto/`

#### ✅ RegisterOperatorDto
**File:** `register-operator.dto.ts`
**Validation:** ✅ Zod schema with proper validation
**Fields:**
- `companyName` (required)
- `registrationNumber` (required)
- `vatNumber` (optional)
- `serviceAreas` (array, min 1)
- `vehicleTypes` (array, min 1)
- `operatingLicenseNumber` (optional)
- `councilRegistration` (optional)
- `businessAddress` (optional)
- `businessPostcode` (optional)
- `emergencyContactName` (optional)
- `emergencyContactPhone` (optional)
- `fleetSize` (optional, number)

**Status:** ✅ Properly implemented and used

#### ✅ UpdateBankDetailsDto
**File:** `update-bank-details.dto.ts`
**Validation:** ✅ Zod schema with proper validation
**Fields:**
- `bankAccountName` (required, min 1)
- `bankAccountNumber` (required, exactly 8 digits)
- `bankSortCode` (required, regex `/^\d{6}$/`)

**Status:** ✅ Properly implemented, ❌ **NOT USED** (no controller endpoint)

### 3.2 Missing DTOs

#### ❌ UpdateOperatorProfileDto
**Status:** **DOES NOT EXIST**
**Impact:** 🔴 **CRITICAL SECURITY VULNERABILITY**

Current controller accepts `@Body() updateData: any` with NO validation.
Operators can modify protected fields:
- `approvalStatus` → Self-approve account
- `reputationScore` → Manipulate rating
- `totalJobs`, `completedJobs` → Fake statistics
- `userId` → Potentially hijack accounts

#### ❌ AddVehicleDto / UpdateVehicleDto
**Status:** **DOES NOT EXIST**
**Impact:** No vehicle management endpoints implemented

#### ❌ AddServiceAreaDto
**Status:** **DOES NOT EXIST**
**Impact:** Cannot update service areas after registration

---

## 4. Service Layer Analysis

### 4.1 OperatorsService Methods
**File:** `src/modules/operators/operators.service.ts`

| Method | Parameters | Validation | Authorization | Status |
|--------|------------|------------|---------------|--------|
| `register()` | userId, RegisterOperatorDto | ✅ DTO validated | ✅ JWT required | ✅ Secure |
| `findOne()` | id | ❌ None | ⚠️ No ownership check | ⚠️ Warning |
| `findByUserId()` | userId | ❌ None | ✅ Uses userId | ✅ Secure |
| `getDashboard()` | userId | ❌ None | ✅ Uses userId | ✅ Secure |
| `updateProfile()` | id, data | ❌ **NO VALIDATION** | ❌ **NO OWNERSHIP CHECK** | 🔴 **CRITICAL** |
| `updateBankDetails()` | userId, UpdateBankDetailsDto | ✅ DTO validated | ✅ Uses userId | ✅ Secure |
| `getBankDetails()` | userId | ❌ None | ✅ Uses userId | ✅ Secure |
| `getDocuments()` | userId | ❌ None | ✅ Uses userId | ✅ Secure |
| `deleteDocument()` | userId, documentId | ✅ Ownership verified | ✅ Uses userId | ✅ Secure |
| `acceptJobOffer()` | userId, bookingRef | ✅ Business logic | ✅ Uses userId | ✅ Secure |
| `declineJobOffer()` | userId, bookingRef | ✅ Business logic | ✅ Uses userId | ✅ Secure |
| `getPendingJobOffers()` | userId | ❌ None | ✅ Uses userId | ✅ Secure |

### 4.2 Critical Issues in updateProfile()

**Current Implementation:**
```typescript
async updateProfile(id: string, data: Partial<OperatorProfile>): Promise<OperatorProfile> {
  return this.prisma.operatorProfile.update({
    where: { id },
    data,  // ❌ Accepts ANY field
  });
}
```

**Problems:**
1. ❌ No field whitelisting
2. ❌ No ownership verification (uses `id` instead of `userId`)
3. ❌ No validation
4. ❌ Allows updating protected fields

**Contrast with updateBankDetails():**
```typescript
async updateBankDetails(userId: string, dto: UpdateBankDetailsDto): Promise<OperatorProfile> {
  const profile = await this.prisma.operatorProfile.findUnique({
    where: { userId },  // ✅ Uses userId for security
  });

  if (!profile) {
    throw new NotFoundException(`Operator profile not found for user ${userId}`);
  }

  return this.prisma.operatorProfile.update({
    where: { id: profile.id },
    data: {
      bankAccountName: dto.bankAccountName,      // ✅ Explicit fields only
      bankAccountNumber: dto.bankAccountNumber,  // ✅ Whitelisted
      bankSortCode: dto.bankSortCode,            // ✅ Validated by DTO
    },
  });
}
```

### 4.3 Document Listing Issue

**Current Implementation:**
```typescript
async getDocuments(userId: string) {
  const profile = await this.prisma.operatorProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new NotFoundException(`Operator profile not found for user ${userId}`);
  }

  return this.prisma.document.findMany({
    where: { operatorId: profile.id },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      documentType: true,
      fileName: true,
      uploadedAt: true,
      // ❌ MISSING: expiresAt
    },
  });
}
```

**Issue:** `expiresAt` field is stored in database but NOT returned to frontend.

---

## 5. Critical Security Issues ✅ **ALL FIXED**

### ✅ FIXED #1: Unvalidated Profile Update Endpoint

**Status:** ✅ **RESOLVED** (2026-01-20)

**What Was Fixed:**

1. **Created UpdateOperatorProfileDto** (`src/modules/operators/dto/update-operator-profile.dto.ts`)
```typescript
export const UpdateOperatorProfileSchema = z.object({
  companyName: z.string().min(1).optional(),
  vatNumber: z.string().optional(),
  operatingLicenseNumber: z.string().optional(),
  councilRegistration: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPostcode: z.string().optional(),
  fleetSize: z.number().int().positive().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  vehicleTypes: z.array(VehicleTypeSchema).optional(),
});
```

2. **Updated Controller** (`src/modules/operators/operators.controller.ts`)
```typescript
@Patch('profile')  // ✅ Changed from 'profile/:id'
async updateProfile(
  @CurrentUser() user: any,  // ✅ Uses current user
  @Body(new ZodValidationPipe(UpdateOperatorProfileSchema)) updateData: UpdateOperatorProfileDto,
) {
  const profile = await this.operatorsService.updateProfile(user.id, updateData);
  return { success: true, data: profile };
}
```

3. **Updated Service** (`src/modules/operators/operators.service.ts`)
```typescript
async updateProfile(userId: string, dto: UpdateOperatorProfileDto): Promise<OperatorProfile> {
  const profile = await this.prisma.operatorProfile.findUnique({
    where: { userId },  // ✅ Uses userId for authorization
  });

  if (!profile) {
    throw new NotFoundException(`Operator profile not found for user ${userId}`);
  }

  return this.prisma.operatorProfile.update({
    where: { id: profile.id },
    data: {
      // ✅ Explicitly whitelisted fields only
      companyName: dto.companyName,
      vatNumber: dto.vatNumber,
      operatingLicenseNumber: dto.operatingLicenseNumber,
      councilRegistration: dto.councilRegistration,
      businessAddress: dto.businessAddress,
      businessPostcode: dto.businessPostcode,
      fleetSize: dto.fleetSize,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
      vehicleTypes: dto.vehicleTypes,
    },
  });
}
```

**Security Improvements:**
- ✅ Protected fields (approvalStatus, reputationScore, totalJobs, etc.) CANNOT be modified
- ✅ Ownership verification using userId
- ✅ Field whitelisting prevents injection attacks
- ✅ Zod validation on all inputs

---

### ✅ FIXED #2: Missing Bank Details Endpoint

**Status:** ✅ **RESOLVED** (2026-01-20)

**What Was Fixed:**

Added dedicated endpoint to `operators.controller.ts`:
```typescript
@Patch('bank-details')
async updateBankDetails(
  @CurrentUser() user: any,
  @Body(new ZodValidationPipe(UpdateBankDetailsSchema)) dto: UpdateBankDetailsDto,
) {
  const profile = await this.operatorsService.updateBankDetails(user.id, dto);
  return { success: true, data: profile };
}
```

**Validation Now Enforced:**
- ✅ `bankAccountName` - Required, min 1 character
- ✅ `bankAccountNumber` - Required, exactly 8 digits
- ✅ `bankSortCode` - Required, exactly 6 digits (regex: `/^\d{6}$/`)

---

## 6. Compliance Issue ✅ **FIXED**

### ✅ FIXED: Document Expiry Date Not Returned

**Status:** ✅ **RESOLVED** (2026-01-20)

**What Was Fixed:**

Updated `getDocuments()` method in `src/modules/operators/operators.service.ts`:

```typescript
return this.prisma.document.findMany({
  where: { operatorId: profile.id },
  orderBy: { uploadedAt: 'desc' },
  select: {
    id: true,
    documentType: true,
    fileName: true,
    uploadedAt: true,
    expiresAt: true,  // ✅ ADDED
  },
});
```

**Compliance Improvements:**
- ✅ Document expiry dates now returned to frontend
- ✅ Enables tracking of license/insurance expiration
- ✅ Frontend can display expiry warnings
- ✅ Admins can identify expired documents

---

## 7. Missing Implementations

### ❌ MISSING #1: Vehicle Management Endpoints

**Database Schema:** ✅ Vehicle model exists (lines 65-79)
**API Specification:** ✅ Documented in `API_SPECIFICATION.md:1228-1255`
**Implementation:** ❌ **NOT IMPLEMENTED**

**Required Endpoints:**
```typescript
POST   /operators/vehicles          // Add vehicle
GET    /operators/vehicles          // List operator's vehicles
PATCH  /operators/vehicles/:id      // Update vehicle
DELETE /operators/vehicles/:id      // Remove vehicle (soft delete)
```

**Required DTOs:**
```typescript
// dto/add-vehicle.dto.ts
export const AddVehicleSchema = z.object({
  vehicleType: VehicleTypeSchema,
  registrationPlate: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
});

// dto/update-vehicle.dto.ts
export const UpdateVehicleSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  isActive: z.boolean().optional(),
});
```

**Impact:**
- Operators cannot manage their fleet
- Vehicle data is read-only after creation
- No way to deactivate vehicles

---

### ❌ MISSING #2: Service Area Management Endpoints

**Database Schema:** ✅ ServiceArea model exists (lines 81-89)
**Current Implementation:** ✅ Created during registration only
**Update/Delete:** ❌ **NOT IMPLEMENTED**

**Required Endpoints:**
```typescript
POST   /operators/service-areas     // Add service area
DELETE /operators/service-areas/:id // Remove service area
```

**Required DTOs:**
```typescript
// dto/add-service-area.dto.ts
export const AddServiceAreaSchema = z.object({
  postcode: z.string().min(1).max(10),
});
```

**Impact:**
- Operators cannot expand service areas
- Operators cannot remove service areas
- Service areas are locked at registration

---

## 8. Warnings

### ⚠️ WARNING #1: Profile Lookup Without Ownership Check

**Location:** `src/modules/operators/operators.service.ts:62-77`

**Current Implementation:**
```typescript
async findOne(id: string): Promise<OperatorProfile> {
  const profile = await this.prisma.operatorProfile.findUnique({
    where: { id },
    include: {
      user: true,
      vehicles: true,
      serviceAreas: true,
    },
  });

  if (!profile) {
    throw new NotFoundException(`Operator with ID ${id} not found`);
  }

  return profile;  // ❌ No ownership verification
}
```

**Issue:**
- Controller endpoint: `GET /operators/profile/:id`
- Any authenticated user can view any operator's profile
- Includes sensitive data: vehicles, service areas, user info

**Recommendation:**
Either:
1. Add ownership check (only allow viewing own profile)
2. Make endpoint admin-only
3. Filter sensitive fields for non-owners

---

## 9. Implementation Recommendations

### Priority 1: Security Fixes (IMMEDIATE)

#### 1.1 Create UpdateOperatorProfileDto
**File:** `src/modules/operators/dto/update-operator-profile.dto.ts`
```typescript
import { z } from 'zod';

export const UpdateOperatorProfileSchema = z.object({
  // Company Information
  companyName: z.string().min(1).optional(),
  vatNumber: z.string().optional(),
  operatingLicenseNumber: z.string().optional(),
  councilRegistration: z.string().optional(),

  // Business Details
  businessAddress: z.string().optional(),
  businessPostcode: z.string().optional(),
  fleetSize: z.number().int().positive().optional(),

  // Emergency Contact
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),

  // Vehicle Types (array of enums)
  vehicleTypes: z.array(VehicleTypeSchema).optional(),
});

export type UpdateOperatorProfileDto = z.infer<typeof UpdateOperatorProfileSchema>;
```

#### 1.2 Update Controller
**File:** `src/modules/operators/operators.controller.ts`
```typescript
@Patch('profile')  // Remove :id param, use current user
async updateProfile(
  @CurrentUser() user: any,
  @Body(new ZodValidationPipe(UpdateOperatorProfileSchema)) updateData: UpdateOperatorProfileDto,
) {
  const profile = await this.operatorsService.updateProfile(user.id, updateData);
  return { success: true, data: profile };
}
```

#### 1.3 Update Service Method
**File:** `src/modules/operators/operators.service.ts`
```typescript
async updateProfile(userId: string, dto: UpdateOperatorProfileDto): Promise<OperatorProfile> {
  const profile = await this.prisma.operatorProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new NotFoundException(`Operator profile not found for user ${userId}`);
  }

  // Explicitly whitelist fields
  return this.prisma.operatorProfile.update({
    where: { id: profile.id },
    data: {
      companyName: dto.companyName,
      vatNumber: dto.vatNumber,
      operatingLicenseNumber: dto.operatingLicenseNumber,
      councilRegistration: dto.councilRegistration,
      businessAddress: dto.businessAddress,
      businessPostcode: dto.businessPostcode,
      fleetSize: dto.fleetSize,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
      vehicleTypes: dto.vehicleTypes,
    },
  });
}
```

#### 1.4 Add Bank Details Endpoint
**File:** `src/modules/operators/operators.controller.ts`
```typescript
@Patch('bank-details')
async updateBankDetails(
  @CurrentUser() user: any,
  @Body(new ZodValidationPipe(UpdateBankDetailsSchema)) dto: UpdateBankDetailsDto,
) {
  const profile = await this.operatorsService.updateBankDetails(user.id, dto);
  return { success: true, data: profile };
}
```

### Priority 2: Compliance Fix (HIGH)

#### 2.1 Return expiresAt in Document List
**File:** `src/modules/operators/operators.service.ts`
```typescript
return this.prisma.document.findMany({
  where: { operatorId: profile.id },
  orderBy: { uploadedAt: 'desc' },
  select: {
    id: true,
    documentType: true,
    fileName: true,
    uploadedAt: true,
    expiresAt: true,  // ✅ Add this
  },
});
```

### Priority 3: Feature Completeness (MEDIUM)

#### 3.1 Implement Vehicle Management
- Create DTOs: `AddVehicleDto`, `UpdateVehicleDto`
- Add controller endpoints
- Add service methods
- Add authorization checks

#### 3.2 Implement Service Area Management
- Create DTO: `AddServiceAreaDto`
- Add controller endpoints
- Add service methods
- Add authorization checks

---

## 10. Testing Checklist

### Security Tests
- [ ] ❌ Attempt to update `approvalStatus` via profile endpoint → Should FAIL
- [ ] ❌ Attempt to update `reputationScore` via profile endpoint → Should FAIL
- [ ] ❌ Attempt to update `totalJobs` via profile endpoint → Should FAIL
- [ ] ❌ Attempt to update `userId` via profile endpoint → Should FAIL
- [ ] ✅ Update allowed fields (companyName, vatNumber, etc.) → Should SUCCEED
- [ ] ✅ Update bank details via dedicated endpoint → Should SUCCEED
- [ ] ❌ Update bank details with invalid sort code → Should FAIL
- [ ] ❌ Update bank details with invalid account number → Should FAIL

### Document Tests
- [ ] ✅ Upload document with `expiresAt` → Should save to database
- [ ] ❌ List documents → Should return `expiresAt` field
- [ ] ✅ Upload document with past `expiresAt` → Should FAIL validation
- [ ] ✅ Delete own document → Should SUCCEED
- [ ] ❌ Delete another operator's document → Should FAIL

### Authorization Tests
- [ ] ❌ View another operator's profile → Should FAIL or filter sensitive data
- [ ] ✅ View own profile → Should SUCCEED
- [ ] ✅ Update own profile → Should SUCCEED
- [ ] ❌ Update another operator's profile → Should FAIL

---

## 11. Summary

### ✅ Critical Issues - ALL FIXED (2026-01-20)
1. ✅ ~~**Unvalidated profile update endpoint**~~ → **FIXED** - Created UpdateOperatorProfileDto with validation
2. ✅ ~~**Missing bank details endpoint**~~ → **FIXED** - Added PATCH /operators/bank-details
3. ✅ ~~**Document expiry not returned**~~ → **FIXED** - Added expiresAt to response

### ⚠️ Out of Scope (Not Implemented)
4. ❌ **Vehicle management endpoints** - Not in current scope
5. ❌ **Service area management endpoints** - Not in current scope
6. ⚠️ **Profile lookup without ownership check** - Low priority

### 📊 Implementation Status
- **Security Fixes:** 2/2 ✅ **COMPLETE**
- **Compliance Fixes:** 1/1 ✅ **COMPLETE**
- **Feature Additions:** 0/2 (Out of scope)

---

## 12. Frontend Team - Required Changes

### 🔄 API Endpoint Changes

#### Change #1: Update Profile Endpoint
**OLD:**
```typescript
PATCH /operators/profile/:id
```

**NEW:**
```typescript
PATCH /operators/profile  // No :id parameter, uses current user from JWT
```

**Request Body (Allowed Fields Only):**
```typescript
{
  companyName?: string;
  vatNumber?: string;
  operatingLicenseNumber?: string;
  councilRegistration?: string;
  businessAddress?: string;
  businessPostcode?: string;
  fleetSize?: number;  // Must be number, not string
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  vehicleTypes?: VehicleType[];  // Array of enums
}
```

**⚠️ IMPORTANT:** Protected fields will be **IGNORED** (not throw error):
- `approvalStatus`, `reputationScore`, `totalJobs`, `completedJobs`, `userId`, `createdAt`, `updatedAt`

#### Change #2: New Bank Details Endpoint
**NEW ENDPOINT:**
```typescript
PATCH /operators/bank-details
```

**Request Body:**
```typescript
{
  bankAccountName: string;      // Required, min 1 char
  bankAccountNumber: string;    // Required, exactly 8 digits
  bankSortCode: string;         // Required, exactly 6 digits (NO dashes)
}
```

**⚠️ Frontend Must Strip Formatting:**
```typescript
// If user enters "12-34-56", strip to "123456"
bankSortCode: bankDetails.sortCode.replace(/[-\s]/g, '')
```

#### Change #3: Documents Response Now Includes expiresAt
**Endpoint:** `GET /operators/documents`

**OLD Response:**
```typescript
{
  success: true,
  data: [
    {
      id: string;
      documentType: string;
      fileName: string;
      uploadedAt: string;
    }
  ]
}
```

**NEW Response:**
```typescript
{
  success: true,
  data: [
    {
      id: string;
      documentType: string;
      fileName: string;
      uploadedAt: string;
      expiresAt: string | null;  // ✅ NOW INCLUDED
    }
  ]
}
```

---

## 13. Frontend Team - TypeScript Interface Updates

### Update #1: Operator Profile Update DTO
**File:** `lib/api/operator.api.ts` (or equivalent)

```typescript
// Request DTO for PATCH /operators/profile
export interface UpdateOperatorProfileDto {
  companyName?: string;
  vatNumber?: string;
  operatingLicenseNumber?: string;
  councilRegistration?: string;
  businessAddress?: string;
  businessPostcode?: string;
  fleetSize?: number;  // ⚠️ Must be number, not string
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  vehicleTypes?: VehicleType[];
}

// API call
export const updateOperatorProfile = async (
  data: UpdateOperatorProfileDto
): Promise<OperatorProfile> => {
  const response = await apiClient.patch<{ success: boolean; data: OperatorProfile }>(
    `/operators/profile`,  // ✅ No :id parameter
    data
  );
  return response.data.data;
};
```

### Update #2: Bank Details DTO
**File:** `lib/api/operator.api.ts` (or equivalent)

```typescript
// Request DTO for PATCH /operators/bank-details
export interface UpdateBankDetailsDto {
  bankAccountName: string;
  bankAccountNumber: string;
  bankSortCode: string;  // Must be 6 digits, no dashes
}

// API call
export const updateBankDetails = async (
  data: UpdateBankDetailsDto
): Promise<OperatorProfile> => {
  // ⚠️ Strip formatting before sending
  const sanitized = {
    ...data,
    bankSortCode: data.bankSortCode.replace(/[-\s]/g, ''),
  };

  const response = await apiClient.patch<{ success: boolean; data: OperatorProfile }>(
    `/operators/bank-details`,  // ✅ New dedicated endpoint
    sanitized
  );
  return response.data.data;
};
```

### Update #3: Document Interface
**File:** `lib/api/operator.api.ts` (or equivalent)

```typescript
// Response interface for GET /operators/documents
export interface OperatorDocument {
  id: string;
  documentType: 'OPERATING_LICENSE' | 'INSURANCE' | 'OTHER';
  fileName: string;
  uploadedAt: string;  // ISO 8601 datetime
  expiresAt: string | null;  // ✅ NOW INCLUDED - ISO 8601 datetime or null
}
```

---

## 14. Frontend Team - Response Format (camelCase)

### ⚠️ IMPORTANT: Prisma Auto-Converts to camelCase

All database fields are automatically converted to **camelCase** in API responses:

**Database Field → API Response:**
```typescript
// Database (snake_case in some ORMs, but Prisma uses camelCase)
{
  bank_account_name    → bankAccountName
  bank_account_number  → bankAccountNumber
  bank_sort_code       → bankSortCode
  company_name         → companyName
  vat_number           → vatNumber
  approval_status      → approvalStatus
  reputation_score     → reputationScore
  total_jobs           → totalJobs
  completed_jobs       → completedJobs
  created_at           → createdAt
  updated_at           → updatedAt
  uploaded_at          → uploadedAt
  expires_at           → expiresAt
  document_type        → documentType
  file_name            → fileName
  file_url             → fileUrl
}
```

**Example Response:**
```typescript
// GET /operators/profile/:id
{
  "success": true,
  "data": {
    "id": "cm5abc123",
    "userId": "cm5xyz789",
    "companyName": "ABC Transport Ltd",
    "registrationNumber": "12345678",
    "vatNumber": "GB123456789",
    "reputationScore": 5.0,
    "totalJobs": 0,
    "completedJobs": 0,
    "approvalStatus": "PENDING",
    "bankAccountName": "ABC Transport",
    "bankAccountNumber": "12345678",
    "bankSortCode": "123456",
    "businessAddress": "123 Main St",
    "businessPostcode": "SW1A 1AA",
    "councilRegistration": "LIC123",
    "emergencyContactName": "John Doe",
    "emergencyContactPhone": "+447700900000",
    "fleetSize": 5,
    "operatingLicenseNumber": "OP123456",
    "vehicleTypes": ["SALOON", "ESTATE"],
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:00:00.000Z"
  }
}
```

**Example Document Response:**
```typescript
// GET /operators/documents
{
  "success": true,
  "data": [
    {
      "id": "cm5doc123",
      "documentType": "OPERATING_LICENSE",
      "fileName": "license.pdf",
      "uploadedAt": "2026-01-20T10:00:00.000Z",
      "expiresAt": "2027-01-20T00:00:00.000Z"  // ✅ NOW INCLUDED
    },
    {
      "id": "cm5doc456",
      "documentType": "INSURANCE",
      "fileName": "insurance.pdf",
      "uploadedAt": "2026-01-20T10:00:00.000Z",
      "expiresAt": null  // No expiry date set
    }
  ]
}
```

---

## 15. Testing Checklist for Frontend Team

### Profile Update Tests
- [ ] Update profile with valid fields → Should succeed
- [ ] Try to update `approvalStatus` → Should be ignored (not error)
- [ ] Try to update `reputationScore` → Should be ignored (not error)
- [ ] Send `fleetSize` as number (not string) → Should succeed
- [ ] Send `fleetSize` as string → Should fail validation

### Bank Details Tests
- [ ] Update bank details with valid data → Should succeed
- [ ] Send sort code with dashes "12-34-56" → Should strip and succeed
- [ ] Send sort code with 5 digits → Should fail validation
- [ ] Send account number with 7 digits → Should fail validation
- [ ] Send account number with 9 digits → Should fail validation

### Document Tests
- [ ] List documents → Should include `expiresAt` field
- [ ] Display expiry warning for documents expiring soon
- [ ] Display expired badge for documents past `expiresAt`
- [ ] Handle `expiresAt: null` gracefully

---

**End of Backend Audit Report**

