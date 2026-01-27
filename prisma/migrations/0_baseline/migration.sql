-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'WITHDRAWN', 'OFFERED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "BookingGroupStatus" AS ENUM ('ACTIVE', 'PARTIALLY_CANCELLED', 'FULLY_CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('RETURN_JOURNEY', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OPERATING_LICENSE', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN_FOR_BIDDING', 'BIDDING_CLOSED', 'NO_BIDS_RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PENDING_ACCEPTANCE');

-- CreateEnum
CREATE TYPE "JourneyType" AS ENUM ('ONE_WAY', 'OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED', 'BOUNCED', 'PENDING');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "OperatorApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('NOT_ELIGIBLE', 'PENDING', 'PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('AIRPORT_PICKUP', 'AIRPORT_DROPOFF', 'POINT_TO_POINT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CUSTOMER_PAYMENT', 'OPERATOR_PAYOUT', 'REFUND', 'PLATFORM_COMMISSION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SALOON', 'ESTATE', 'MPV', 'EXECUTIVE', 'MINIBUS', 'EXECUTIVE_LUXURY', 'EXECUTIVE_PEOPLE_CARRIER', 'GREEN_CAR');

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "bidAmount" DECIMAL(10,2) NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "offeredAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_groups" (
    "id" TEXT NOT NULL,
    "groupReference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "discountType" "DiscountType",
    "discountAmount" DECIMAL(10,2),
    "status" "BookingGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingReference" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "pickupPostcode" TEXT,
    "pickupLat" DECIMAL(10,8) NOT NULL,
    "pickupLng" DECIMAL(11,8) NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffPostcode" TEXT,
    "dropoffLat" DECIMAL(10,8) NOT NULL,
    "dropoffLng" DECIMAL(11,8) NOT NULL,
    "pickupDatetime" TIMESTAMP(3) NOT NULL,
    "passengerCount" INTEGER NOT NULL,
    "luggageCount" INTEGER NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "flightNumber" TEXT,
    "specialRequirements" TEXT,
    "customerPrice" DECIMAL(10,2) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bookingGroupId" TEXT,
    "journeyType" "JourneyType" NOT NULL DEFAULT 'ONE_WAY',
    "linkedBookingId" TEXT,
    "amendedAt" TIMESTAMP(3),
    "amendmentFee" DECIMAL(10,2),
    "boosterSeats" INTEGER NOT NULL DEFAULT 0,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "childSeats" INTEGER NOT NULL DEFAULT 0,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "distanceMiles" DECIMAL(10,2),
    "driverArrivedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "hasMeetAndGreet" BOOLEAN NOT NULL DEFAULT false,
    "hasPickAndDrop" BOOLEAN NOT NULL DEFAULT false,
    "markedNoShowAt" TIMESTAMP(3),
    "noShowCharges" DECIMAL(10,2),
    "originalPrice" DECIMAL(10,2),
    "passengerPickedUpAt" TIMESTAMP(3),
    "refundAmount" DECIMAL(10,2),
    "refundPercent" INTEGER,
    "terminal" TEXT,
    "waitingCharges" DECIMAL(10,2),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hoursBeforePickup" INTEGER NOT NULL,
    "refundPercent" INTEGER NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_details" (
    "id" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL,
    "vehicleRegistration" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "issuingCouncil" TEXT,
    "jobId" TEXT NOT NULL,
    "taxiLicenceNumber" TEXT,
    "vehicleColor" TEXT,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,

    CONSTRAINT "driver_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN_FOR_BIDDING',
    "biddingWindowClosesAt" TIMESTAMP(3) NOT NULL,
    "assignedOperatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptanceAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "acceptanceWindowClosesAt" TIMESTAMP(3),
    "acceptanceWindowOpensAt" TIMESTAMP(3),
    "biddingWindowDurationHours" INTEGER NOT NULL DEFAULT 24,
    "biddingWindowOpensAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "currentOfferedBidId" TEXT,
    "payoutEligibleAt" TIMESTAMP(3),
    "payoutProcessedAt" TIMESTAMP(3),
    "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "payoutTransactionId" TEXT,
    "platformMargin" DECIMAL(10,2),
    "winningBidId" TEXT,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "templateId" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'EMAIL',

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "vatNumber" TEXT,
    "reputationScore" DECIMAL(3,2) NOT NULL DEFAULT 5.0,
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvalStatus" "OperatorApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankSortCode" TEXT,
    "businessAddress" TEXT,
    "businessPostcode" TEXT,
    "councilRegistration" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "fleetSize" INTEGER,
    "operatingLicenseNumber" TEXT,
    "vehicleTypes" "VehicleType"[],

    CONSTRAINT "operator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "vehicleType" "VehicleType",
    "baseValue" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "airportCode" TEXT,
    "endDate" TIMESTAMP(3),
    "endTime" TEXT,
    "percentage" DECIMAL(5,2),
    "startDate" TIMESTAMP(3),
    "startTime" TEXT,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_areas" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "stripeTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "description" TEXT,
    "metadata" JSONB,
    "stripePaymentIntentId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "role" "UserRole" NOT NULL,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_capacities" (
    "id" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "maxPassengers" INTEGER NOT NULL,
    "maxPassengersHandOnly" INTEGER,
    "maxSuitcases" INTEGER NOT NULL,
    "maxHandLuggage" INTEGER NOT NULL DEFAULT 2,
    "rateReductionPer100Miles" DECIMAL(5,2),
    "exampleModels" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_capacities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "registrationPlate" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bids_jobId_operatorId_key" ON "bids"("jobId" ASC, "operatorId" ASC);

-- CreateIndex
CREATE INDEX "bids_operatorId_idx" ON "bids"("operatorId" ASC);

-- CreateIndex
CREATE INDEX "bids_status_idx" ON "bids"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "booking_groups_groupReference_key" ON "booking_groups"("groupReference" ASC);

-- CreateIndex
CREATE INDEX "bookings_bookingGroupId_idx" ON "bookings"("bookingGroupId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_bookingReference_key" ON "bookings"("bookingReference" ASC);

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "bookings"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_linkedBookingId_key" ON "bookings"("linkedBookingId" ASC);

-- CreateIndex
CREATE INDEX "bookings_pickupDatetime_idx" ON "bookings"("pickupDatetime" ASC);

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_policies_hoursBeforePickup_key" ON "cancellation_policies"("hoursBeforePickup" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "driver_details_jobId_key" ON "driver_details"("jobId" ASC);

-- CreateIndex
CREATE INDEX "jobs_acceptanceWindowClosesAt_idx" ON "jobs"("acceptanceWindowClosesAt" ASC);

-- CreateIndex
CREATE INDEX "jobs_assignedOperatorId_idx" ON "jobs"("assignedOperatorId" ASC);

-- CreateIndex
CREATE INDEX "jobs_biddingWindowClosesAt_idx" ON "jobs"("biddingWindowClosesAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_bookingId_key" ON "jobs"("bookingId" ASC);

-- CreateIndex
CREATE INDEX "jobs_payoutStatus_idx" ON "jobs"("payoutStatus" ASC);

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_winningBidId_key" ON "jobs"("winningBidId" ASC);

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status" ASC);

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type" ASC);

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId" ASC);

-- CreateIndex
CREATE INDEX "operator_profiles_approvalStatus_idx" ON "operator_profiles"("approvalStatus" ASC);

-- CreateIndex
CREATE INDEX "operator_profiles_userId_idx" ON "operator_profiles"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "operator_profiles_userId_key" ON "operator_profiles"("userId" ASC);

-- CreateIndex
CREATE INDEX "pricing_rules_isActive_idx" ON "pricing_rules"("isActive" ASC);

-- CreateIndex
CREATE INDEX "pricing_rules_ruleType_idx" ON "pricing_rules"("ruleType" ASC);

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category" ASC);

-- CreateIndex
CREATE INDEX "system_settings_isActive_idx" ON "system_settings"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key" ASC);

-- CreateIndex
CREATE INDEX "transactions_bookingId_idx" ON "transactions"("bookingId" ASC);

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status" ASC);

-- CreateIndex
CREATE INDEX "transactions_transactionType_idx" ON "transactions"("transactionType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_capacities_vehicleType_key" ON "vehicle_capacities"("vehicleType" ASC);

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId") REFERENCES "booking_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_linkedBookingId_fkey" FOREIGN KEY ("linkedBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_details" ADD CONSTRAINT "driver_details_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "operator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_profiles" ADD CONSTRAINT "operator_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

