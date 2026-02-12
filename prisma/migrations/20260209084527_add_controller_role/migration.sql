-- CreateEnum
CREATE TYPE "ControllerPermission" AS ENUM ('OPERATOR_VIEW', 'OPERATOR_APPROVE', 'OPERATOR_REJECT', 'OPERATOR_SUSPEND', 'BOOKING_VIEW', 'BOOKING_REFUND', 'JOB_VIEW', 'JOB_ASSIGN', 'JOB_CLOSE_BIDDING', 'JOB_REOPEN_BIDDING', 'JOB_CONFIRM_COMPLETION', 'DRIVER_VIEW', 'DRIVER_APPROVE', 'DRIVER_REJECT', 'VEHICLE_VIEW', 'VEHICLE_APPROVE', 'VEHICLE_REJECT', 'DOCUMENT_VIEW', 'DOCUMENT_VERIFY', 'CUSTOMER_VIEW', 'CUSTOMER_VIEW_BOOKINGS', 'CUSTOMER_VIEW_TRANSACTIONS_LIMITED', 'CUSTOMER_UPDATE_STATUS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('OPERATOR_APPROVED', 'OPERATOR_REJECTED', 'OPERATOR_SUSPENDED', 'OPERATOR_REINSTATED', 'BOOKING_VIEWED', 'BOOKING_REFUNDED', 'JOB_VIEWED', 'JOB_ASSIGNED', 'JOB_BIDDING_CLOSED', 'JOB_BIDDING_REOPENED', 'JOB_COMPLETION_CONFIRMED', 'JOB_COMPLETION_REJECTED', 'DRIVER_APPROVED', 'DRIVER_REJECTED', 'VEHICLE_APPROVED', 'VEHICLE_REJECTED', 'CUSTOMER_ACTIVATED', 'CUSTOMER_DEACTIVATED', 'CONTROLLER_CREATED', 'CONTROLLER_PERMISSIONS_UPDATED', 'CONTROLLER_ACTIVATED', 'CONTROLLER_DEACTIVATED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CONTROLLER';

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "ControllerPermission" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userRole" "UserRole" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permissions_userId_idx" ON "user_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permission_key" ON "user_permissions"("userId", "permission");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
