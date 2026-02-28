-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('whatsapp', 'sms');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('first_timer', 'returning', 'member', 'visitor');

-- CreateEnum
CREATE TYPE "ParseJobStatus" AS ENUM ('pending', 'parsing', 'done', 'error');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'queued', 'sending', 'sent', 'failed', 'rate_limited');

-- CreateEnum
CREATE TYPE "Scenario" AS ENUM ('first_timer', 'follow_up', 'event_invite', 'prayer_request', 'general');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "sessionToken" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "sessionState" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parse_jobs" (
    "id" TEXT NOT NULL,
    "status" "ParseJobStatus" NOT NULL DEFAULT 'pending',
    "r2_key" TEXT NOT NULL,
    "r2_bucket" TEXT NOT NULL,
    "original_filename" TEXT,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "raw_extracted_text" TEXT,
    "confidence" DOUBLE PRECISION,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error_message" TEXT,
    "inngest_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "parse_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "parse_job_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'visitor',
    "email" TEXT,
    "notes" TEXT,
    "raw_row" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "scenario" "Scenario" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "whatsapp_template" TEXT NOT NULL,
    "sms_template" TEXT NOT NULL,
    "use_custom_template" BOOLEAN NOT NULL DEFAULT false,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "sent_messages" INTEGER NOT NULL DEFAULT 0,
    "failed_messages" INTEGER NOT NULL DEFAULT 0,
    "inngest_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'queued',
    "twilio_sid" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "parse_jobs_status_idx" ON "parse_jobs"("status");

-- CreateIndex
CREATE INDEX "parse_jobs_created_at_idx" ON "parse_jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "contacts_parse_job_id_idx" ON "contacts"("parse_job_id");

-- CreateIndex
CREATE INDEX "contacts_channel_idx" ON "contacts"("channel");

-- CreateIndex
CREATE INDEX "contacts_type_idx" ON "contacts"("type");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_created_at_idx" ON "campaigns"("created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_campaign_id_idx" ON "messages"("campaign_id");

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "messages"("status");

-- CreateIndex
CREATE INDEX "messages_channel_idx" ON "messages"("channel");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_parse_job_id_fkey" FOREIGN KEY ("parse_job_id") REFERENCES "parse_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
