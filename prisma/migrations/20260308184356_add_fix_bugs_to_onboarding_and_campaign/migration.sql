-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "sender_id" TEXT,
ADD COLUMN     "use_platform_sender" BOOLEAN NOT NULL DEFAULT true;
