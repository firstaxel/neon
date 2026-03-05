-- CreateEnum
CREATE TYPE "Purpose" AS ENUM ('general', 'welcome', 'follow_up', 'reminder', 'event', 'announcement', 'support', 'promotion');

-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN     "purpose" "Purpose" NOT NULL DEFAULT 'general';
