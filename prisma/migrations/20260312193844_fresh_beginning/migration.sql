-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('whatsapp', 'sms');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('new_contact', 'returning', 'contact', 'prospect');

-- CreateEnum
CREATE TYPE "ParseJobStatus" AS ENUM ('pending', 'parsing', 'done', 'error');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'rate_limited', 'opted_out');

-- CreateEnum
CREATE TYPE "Scenario" AS ENUM ('first_timer', 'follow_up', 'event_invite', 'request', 'general');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('marketing', 'utility_prescreen', 'sms_fallback');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'message_debit', 'campaign_hold', 'campaign_refund', 'subscription', 'refund');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'completed', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'paused', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'growth', 'pro');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'leader', 'manager', 'staff', 'volunteer', 'coordinator');

-- CreateEnum
CREATE TYPE "WaTemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');

-- CreateEnum
CREATE TYPE "WaTemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WaHeaderFormat" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION');

-- CreateEnum
CREATE TYPE "WaButtonType" AS ENUM ('QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE');

-- CreateEnum
CREATE TYPE "Purpose" AS ENUM ('general', 'welcome', 'follow_up', 'reminder', 'event', 'announcement', 'support', 'promotion');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('pending', 'approved', 'declined');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL DEFAULT '',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "sessionState" TEXT,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "password" TEXT,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
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
    "parsedBy" TEXT NOT NULL,

    CONSTRAINT "parse_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "parse_job_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'prospect',
    "email" TEXT,
    "notes" TEXT,
    "raw_row" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "opted_out" BOOLEAN NOT NULL DEFAULT false,
    "opted_out_at" TIMESTAMP(3),
    "last_inbound_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scenario" "Scenario" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "delivery_mode" "DeliveryMode" NOT NULL DEFAULT 'marketing',
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
    "delivered_at" TIMESTAMP(3),
    "from_number" TEXT,
    "meta_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance_kobo" INTEGER NOT NULL DEFAULT 0,
    "held_kobo" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "amount_kobo" INTEGER NOT NULL,
    "balance_after_kobo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paystack_ref" TEXT,
    "campaign_id" TEXT,
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "paystack_customer_code" TEXT,
    "paystack_sub_code" TEXT,
    "paystack_plan_code" TEXT,
    "monthly_message_limit" INTEGER NOT NULL,
    "messages_used_this_cycle" INTEGER NOT NULL DEFAULT 0,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_type" TEXT,
    "org_name" TEXT,
    "org_size" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "phone" TEXT,
    "sender_id" TEXT,
    "use_platform_sender" BOOLEAN NOT NULL DEFAULT true,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_step" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" "WaTemplateCategory" NOT NULL DEFAULT 'MARKETING',
    "purpose" "Purpose" NOT NULL DEFAULT 'general',
    "status" "WaTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "wa_template_id" TEXT,
    "wa_account_id" TEXT,
    "rejection_reason" TEXT,
    "header_format" "WaHeaderFormat",
    "header_text" TEXT,
    "header_vars" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "body_text" TEXT NOT NULL,
    "body_vars" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "footer_text" TEXT,
    "buttons" JSONB NOT NULL DEFAULT '[]',
    "channel" "MessageChannel" NOT NULL DEFAULT 'whatsapp',
    "sms_body" TEXT NOT NULL,
    "sms_vars" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scenario_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sender_numbers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sender_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_deliveries" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "realMessage" TEXT NOT NULL,
    "prescreen_msg_id" TEXT,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "replied_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_id" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "body" TEXT NOT NULL,
    "campaign_id" TEXT,
    "external_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "replied_at" TIMESTAMP(3),
    "is_keyword" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_invites" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_join_requests" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MessageToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MessageToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "parse_jobs_status_idx" ON "parse_jobs"("status");

-- CreateIndex
CREATE INDEX "parse_jobs_parsedBy_idx" ON "parse_jobs"("parsedBy");

-- CreateIndex
CREATE INDEX "parse_jobs_created_at_idx" ON "parse_jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "contacts_parse_job_id_idx" ON "contacts"("parse_job_id");

-- CreateIndex
CREATE INDEX "contacts_uploadedBy_idx" ON "contacts"("uploadedBy");

-- CreateIndex
CREATE INDEX "contacts_channel_idx" ON "contacts"("channel");

-- CreateIndex
CREATE INDEX "contacts_type_idx" ON "contacts"("type");

-- CreateIndex
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_uploadedBy_phone_key" ON "contacts"("uploadedBy", "phone");

-- CreateIndex
CREATE INDEX "campaigns_user_id_idx" ON "campaigns"("user_id");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_created_at_idx" ON "campaigns"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "messages_meta_message_id_key" ON "messages"("meta_message_id");

-- CreateIndex
CREATE INDEX "messages_campaign_id_idx" ON "messages"("campaign_id");

-- CreateIndex
CREATE INDEX "messages_campaign_id_status_idx" ON "messages"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "messages"("status");

-- CreateIndex
CREATE INDEX "messages_channel_idx" ON "messages"("channel");

-- CreateIndex
CREATE INDEX "messages_meta_message_id_idx" ON "messages"("meta_message_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE INDEX "transactions_wallet_id_idx" ON "transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "transactions_campaign_id_idx" ON "transactions"("campaign_id");

-- CreateIndex
CREATE INDEX "transactions_wallet_id_created_at_idx" ON "transactions"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "message_templates_user_id_idx" ON "message_templates"("user_id");

-- CreateIndex
CREATE INDEX "message_templates_user_id_purpose_idx" ON "message_templates"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "message_templates_user_id_scenario_id_idx" ON "message_templates"("user_id", "scenario_id");

-- CreateIndex
CREATE INDEX "message_templates_user_id_scenario_id_is_default_idx" ON "message_templates"("user_id", "scenario_id", "is_default");

-- CreateIndex
CREATE INDEX "message_templates_created_at_idx" ON "message_templates"("created_at" DESC);

-- CreateIndex
CREATE INDEX "message_templates_user_id_channel_idx" ON "message_templates"("user_id", "channel");

-- CreateIndex
CREATE INDEX "message_templates_user_id_status_idx" ON "message_templates"("user_id", "status");

-- CreateIndex
CREATE INDEX "message_templates_user_id_category_idx" ON "message_templates"("user_id", "category");

-- CreateIndex
CREATE INDEX "sender_numbers_user_id_channel_is_active_idx" ON "sender_numbers"("user_id", "channel", "is_active");

-- CreateIndex
CREATE INDEX "pending_deliveries_phone_idx" ON "pending_deliveries"("phone");

-- CreateIndex
CREATE INDEX "pending_deliveries_campaign_id_idx" ON "pending_deliveries"("campaign_id");

-- CreateIndex
CREATE INDEX "pending_deliveries_expires_at_idx" ON "pending_deliveries"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_external_id_key" ON "inbound_messages"("external_id");

-- CreateIndex
CREATE INDEX "inbound_messages_user_id_received_at_idx" ON "inbound_messages"("user_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "inbound_messages_phone_idx" ON "inbound_messages"("phone");

-- CreateIndex
CREATE INDEX "inbound_messages_user_id_replied_idx" ON "inbound_messages"("user_id", "replied");

-- CreateIndex
CREATE INDEX "inbound_messages_external_id_idx" ON "inbound_messages"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_invites_token_key" ON "org_invites"("token");

-- CreateIndex
CREATE INDEX "org_invites_owner_id_idx" ON "org_invites"("owner_id");

-- CreateIndex
CREATE INDEX "org_invites_token_idx" ON "org_invites"("token");

-- CreateIndex
CREATE INDEX "org_members_user_id_idx" ON "org_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_members_owner_id_user_id_key" ON "org_members"("owner_id", "user_id");

-- CreateIndex
CREATE INDEX "org_join_requests_owner_id_status_idx" ON "org_join_requests"("owner_id", "status");

-- CreateIndex
CREATE INDEX "org_join_requests_user_id_idx" ON "org_join_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_join_requests_owner_id_user_id_key" ON "org_join_requests"("owner_id", "user_id");

-- CreateIndex
CREATE INDEX "_MessageToUser_B_index" ON "_MessageToUser"("B");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parse_jobs" ADD CONSTRAINT "parse_jobs_parsedBy_fkey" FOREIGN KEY ("parsedBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_parse_job_id_fkey" FOREIGN KEY ("parse_job_id") REFERENCES "parse_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sender_numbers" ADD CONSTRAINT "sender_numbers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_deliveries" ADD CONSTRAINT "pending_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_join_requests" ADD CONSTRAINT "org_join_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_join_requests" ADD CONSTRAINT "org_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageToUser" ADD CONSTRAINT "_MessageToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageToUser" ADD CONSTRAINT "_MessageToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
