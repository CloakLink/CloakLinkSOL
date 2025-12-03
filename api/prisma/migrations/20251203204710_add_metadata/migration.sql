-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "tokenAddress" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "tokenDecimals" INTEGER;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Profile" ADD COLUMN "description" TEXT;
