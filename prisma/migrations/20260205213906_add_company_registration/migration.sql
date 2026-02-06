-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'COMPANY_REGISTRATION';

-- AlterTable
ALTER TABLE "operator_profiles" ADD COLUMN     "companyRegistrationCertificateUrl" TEXT;
