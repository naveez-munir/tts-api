/*
  Warnings:

  - The values [OPEN] on the enum `JobStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `operatorId` on the `driver_details` table. All the data in the column will be lost.
  - You are about to drop the column `notificationType` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `isApproved` on the `operator_profiles` table. All the data in the column will be lost.
  - The `status` column on the `transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[jobId]` on the table `driver_details` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[winningBidId]` on the table `jobs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `jobId` to the `driver_details` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "OperatorApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterEnum
BEGIN;
CREATE TYPE "JobStatus_new" AS ENUM ('OPEN_FOR_BIDDING', 'BIDDING_CLOSED', 'NO_BIDS_RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "jobs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "jobs" ALTER COLUMN "status" TYPE "JobStatus_new" USING ("status"::text::"JobStatus_new");
ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "JobStatus_old";
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'OPEN_FOR_BIDDING';
COMMIT;

-- AlterEnum - Add PENDING value (must be committed separately in PostgreSQL)
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'PENDING';
COMMIT;
BEGIN;

-- DropForeignKey
ALTER TABLE "driver_details" DROP CONSTRAINT "driver_details_operatorId_fkey";

-- AlterTable
ALTER TABLE "bids" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "distanceMiles" DECIMAL(10,2),
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "hasMeetAndGreet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terminal" TEXT;

-- AlterTable
ALTER TABLE "driver_details" DROP COLUMN "operatorId",
ADD COLUMN     "jobId" TEXT NOT NULL,
ADD COLUMN     "vehicleColor" TEXT,
ADD COLUMN     "vehicleMake" TEXT,
ADD COLUMN     "vehicleModel" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "biddingWindowDurationHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "biddingWindowOpensAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "platformMargin" DECIMAL(10,2),
ADD COLUMN     "winningBidId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'OPEN_FOR_BIDDING';

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "notificationType",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "recipientPhone" TEXT,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'EMAIL',
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "sentAt" DROP NOT NULL,
ALTER COLUMN "sentAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "operator_profiles" DROP COLUMN "isApproved",
ADD COLUMN     "approvalStatus" "OperatorApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankSortCode" TEXT;

-- AlterTable
ALTER TABLE "pricing_rules" ADD COLUMN     "airportCode" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "percentage" DECIMAL(5,2),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "startTime" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "stripePaymentIntentId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "bids_operatorId_idx" ON "bids"("operatorId");

-- CreateIndex
CREATE INDEX "bids_status_idx" ON "bids"("status");

-- CreateIndex
CREATE INDEX "bookings_customerId_idx" ON "bookings"("customerId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_pickupDatetime_idx" ON "bookings"("pickupDatetime");

-- CreateIndex
CREATE INDEX "bookings_bookingGroupId_idx" ON "bookings"("bookingGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "driver_details_jobId_key" ON "driver_details"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_winningBidId_key" ON "jobs"("winningBidId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_assignedOperatorId_idx" ON "jobs"("assignedOperatorId");

-- CreateIndex
CREATE INDEX "jobs_biddingWindowClosesAt_idx" ON "jobs"("biddingWindowClosesAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "operator_profiles_approvalStatus_idx" ON "operator_profiles"("approvalStatus");

-- CreateIndex
CREATE INDEX "operator_profiles_userId_idx" ON "operator_profiles"("userId");

-- CreateIndex
CREATE INDEX "pricing_rules_ruleType_idx" ON "pricing_rules"("ruleType");

-- CreateIndex
CREATE INDEX "pricing_rules_isActive_idx" ON "pricing_rules"("isActive");

-- CreateIndex
CREATE INDEX "transactions_bookingId_idx" ON "transactions"("bookingId");

-- CreateIndex
CREATE INDEX "transactions_transactionType_idx" ON "transactions"("transactionType");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "operator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_details" ADD CONSTRAINT "driver_details_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
