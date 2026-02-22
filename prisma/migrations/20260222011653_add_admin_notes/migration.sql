-- CreateEnum
CREATE TYPE "AdminNoteTargetType" AS ENUM ('CUSTOMER', 'OPERATOR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'VEHICLE_CAPACITY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_NOTE_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_NOTE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'OPERATOR_NOTE_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'OPERATOR_NOTE_UPDATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ControllerPermission" ADD VALUE 'CUSTOMER_ADD_NOTE';
ALTER TYPE "ControllerPermission" ADD VALUE 'CUSTOMER_EDIT_NOTE';
ALTER TYPE "ControllerPermission" ADD VALUE 'OPERATOR_ADD_NOTE';
ALTER TYPE "ControllerPermission" ADD VALUE 'OPERATOR_EDIT_NOTE';

-- CreateTable
CREATE TABLE "admin_notes" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetType" "AdminNoteTargetType" NOT NULL,
    "targetUserId" TEXT,
    "targetOperatorId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_notes_targetUserId_idx" ON "admin_notes"("targetUserId");

-- CreateIndex
CREATE INDEX "admin_notes_targetOperatorId_idx" ON "admin_notes"("targetOperatorId");

-- CreateIndex
CREATE INDEX "admin_notes_createdById_idx" ON "admin_notes"("createdById");

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_targetOperatorId_fkey" FOREIGN KEY ("targetOperatorId") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
