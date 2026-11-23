-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "fromEmail" TEXT NOT NULL DEFAULT 'demo@example.com',
ADD COLUMN     "fromName" TEXT NOT NULL DEFAULT 'ReachInbox Demo';
