-- CreateEnum
CREATE TYPE "VehiclePhotoType" AS ENUM ('FRONT', 'BACK', 'DRIVER_SIDE', 'FRONT_SIDE', 'DASHBOARD', 'REAR_BOOT');

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "drivingLicenseBackUrl" TEXT,
ADD COLUMN     "drivingLicenseExpiry" TIMESTAMP(3),
ADD COLUMN     "drivingLicenseFrontUrl" TEXT,
ADD COLUMN     "nationalInsuranceDocUrl" TEXT,
ADD COLUMN     "passportExpiry" TIMESTAMP(3),
ADD COLUMN     "passportUrl" TEXT,
ADD COLUMN     "taxiBadgeExpiry" TIMESTAMP(3),
ADD COLUMN     "taxiBadgePhotoUrl" TEXT,
ADD COLUMN     "taxiCertificationExpiry" TIMESTAMP(3),
ADD COLUMN     "taxiCertificationUrl" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "hirePermissionLetterUrl" TEXT,
ADD COLUMN     "insuranceDocumentUrl" TEXT,
ADD COLUMN     "insuranceExpiryDate" TIMESTAMP(3),
ADD COLUMN     "logbookUrl" TEXT,
ADD COLUMN     "motCertificateUrl" TEXT,
ADD COLUMN     "motExpiryDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "vehicle_photos" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "photoType" "VehiclePhotoType" NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_photos_vehicleId_photoType_key" ON "vehicle_photos"("vehicleId", "photoType");

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
