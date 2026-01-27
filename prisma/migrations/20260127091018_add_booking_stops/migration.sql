/*
  Warnings:

  - You are about to drop the column `hasPickAndDrop` on the `bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "hasPickAndDrop";

-- CreateTable
CREATE TABLE "booking_stops" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT,
    "lat" DECIMAL(10,8) NOT NULL,
    "lng" DECIMAL(11,8) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_stops_bookingId_idx" ON "booking_stops"("bookingId");

-- AddForeignKey
ALTER TABLE "booking_stops" ADD CONSTRAINT "booking_stops_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
