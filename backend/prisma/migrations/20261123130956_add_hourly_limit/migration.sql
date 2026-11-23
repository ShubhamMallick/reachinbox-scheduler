-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "hourlyLimit" INTEGER NOT NULL DEFAULT 100;

-- CreateIndex
CREATE INDEX "Email_senderKey_scheduledAt_idx" ON "Email"("senderKey", "scheduledAt");
