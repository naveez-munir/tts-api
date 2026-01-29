-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "drivingLicenseNumber" TEXT,
    "phvLicenseNumber" TEXT,
    "phvLicenseExpiry" TIMESTAMP(3),
    "issuingCouncil" TEXT,
    "badgeNumber" TEXT,
    "nationalInsuranceNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
