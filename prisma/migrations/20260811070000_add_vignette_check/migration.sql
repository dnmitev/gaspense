-- CreateEnum
CREATE TYPE "VignetteOutcome" AS ENUM ('ACTIVE', 'NONE', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "VignetteCheck" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" "VignetteOutcome" NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "vignetteNumber" TEXT,
    "exempt" BOOLEAN,
    "failureReason" TEXT,

    CONSTRAINT "VignetteCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VignetteCheck_carId_idx" ON "VignetteCheck"("carId");

-- CreateIndex
CREATE INDEX "VignetteCheck_checkedAt_idx" ON "VignetteCheck"("checkedAt");

-- AddForeignKey
ALTER TABLE "VignetteCheck" ADD CONSTRAINT "VignetteCheck_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

