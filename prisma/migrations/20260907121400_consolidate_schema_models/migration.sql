-- AlterEnum
BEGIN;
CREATE TYPE "TransactionType_new" AS ENUM ('deposit', 'message_debit', 'campaign_hold', 'campaign_refund', 'refund');
UPDATE "transactions" SET "type" = 'deposit' WHERE "type"::text = 'subscription';
ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "TransactionType_new" USING ("type"::text::"TransactionType_new");
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "public"."TransactionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "_MessageToUser" DROP CONSTRAINT IF EXISTS "_MessageToUser_A_fkey";
ALTER TABLE "_MessageToUser" DROP CONSTRAINT IF EXISTS "_MessageToUser_B_fkey";
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_parse_job_id_fkey";
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_uploadedBy_fkey";
ALTER TABLE "parse_jobs" DROP CONSTRAINT IF EXISTS "parse_jobs_parsedBy_fkey";
ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_userId_fkey";
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_user_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "contacts_uploadedBy_idx";
DROP INDEX IF EXISTS "contacts_uploadedBy_phone_key";
DROP INDEX IF EXISTS "parse_jobs_parsedBy_idx";

-- AlterTable campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "sender_id" TEXT;

-- Column renames and adjustments on parse_jobs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parse_jobs' AND column_name = 'parsedBy') THEN
    ALTER TABLE "parse_jobs" RENAME COLUMN "parsedBy" TO "parsed_by";
  END IF;
END $$;

-- Column renames and adjustments on contacts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'uploadedBy') THEN
    ALTER TABLE "contacts" RENAME COLUMN "uploadedBy" TO "uploaded_by";
  END IF;
END $$;

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "contacts" ALTER COLUMN "parse_job_id" DROP NOT NULL;

-- AlterTable messages
ALTER TABLE "messages" DROP COLUMN IF EXISTS "twilio_sid";
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "termii_message_id" TEXT;

-- DropTable
DROP TABLE IF EXISTS "_MessageToUser";
DROP TABLE IF EXISTS "subscriptions";

-- DropEnum
DROP TYPE IF EXISTS "SubscriptionPlan";
DROP TYPE IF EXISTS "SubscriptionStatus";

-- Automated deduplication of contacts per (uploaded_by, phone) before creating unique index
DELETE FROM contacts a USING contacts b
WHERE a.uploaded_by = b.uploaded_by
  AND a.phone = b.phone
  AND a.created_at < b.created_at;

-- Automated deduplication of wallets per user keeping the latest balance
DELETE FROM wallets a USING wallets b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Enforce database level financial balance check on wallets
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "check_balance_held";
ALTER TABLE "wallets" ADD CONSTRAINT "check_balance_held" CHECK (balance_kobo >= held_kobo);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_uploaded_by_idx" ON "contacts"("uploaded_by");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_uploaded_by_phone_key" ON "contacts"("uploaded_by", "phone");
CREATE UNIQUE INDEX IF NOT EXISTS "messages_termii_message_id_key" ON "messages"("termii_message_id");
CREATE INDEX IF NOT EXISTS "messages_campaign_id_channel_idx" ON "messages"("campaign_id", "channel");
CREATE INDEX IF NOT EXISTS "messages_termii_message_id_idx" ON "messages"("termii_message_id");
CREATE INDEX IF NOT EXISTS "parse_jobs_parsed_by_idx" ON "parse_jobs"("parsed_by");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parse_jobs" ADD CONSTRAINT "parse_jobs_parsed_by_fkey" FOREIGN KEY ("parsed_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_parse_job_id_fkey" FOREIGN KEY ("parse_job_id") REFERENCES "parse_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
