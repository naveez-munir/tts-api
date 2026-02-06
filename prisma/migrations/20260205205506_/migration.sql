-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false;
