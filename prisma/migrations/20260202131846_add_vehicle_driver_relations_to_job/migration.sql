-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "assignedDriverId" TEXT,
ADD COLUMN     "assignedVehicleId" TEXT;

-- CreateIndex
CREATE INDEX "jobs_assignedDriverId_idx" ON "jobs"("assignedDriverId");

-- CreateIndex
CREATE INDEX "jobs_assignedVehicleId_idx" ON "jobs"("assignedVehicleId");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
