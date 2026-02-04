/*
  Warnings:

  - A unique constraint covering the columns `[vehicleId]` on the table `drivers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "vehicleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "drivers_vehicleId_key" ON "drivers"("vehicleId");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
