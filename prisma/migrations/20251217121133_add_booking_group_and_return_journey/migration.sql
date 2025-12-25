/*
  Warnings:

  - A unique constraint covering the columns `[linkedBookingId]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JourneyType" AS ENUM ('ONE_WAY', 'OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "BookingGroupStatus" AS ENUM ('ACTIVE', 'PARTIALLY_CANCELLED', 'FULLY_CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('RETURN_JOURNEY', 'PROMOTIONAL');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "bookingGroupId" TEXT,
ADD COLUMN     "journeyType" "JourneyType" NOT NULL DEFAULT 'ONE_WAY',
ADD COLUMN     "linkedBookingId" TEXT;

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

-- CreateIndex
CREATE UNIQUE INDEX "booking_groups_groupReference_key" ON "booking_groups"("groupReference");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_linkedBookingId_key" ON "bookings"("linkedBookingId");

-- AddForeignKey
ALTER TABLE "booking_groups" ADD CONSTRAINT "booking_groups_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId") REFERENCES "booking_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_linkedBookingId_fkey" FOREIGN KEY ("linkedBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
