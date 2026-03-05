-- CreateEnum
CREATE TYPE "WaTemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');

-- CreateEnum
CREATE TYPE "WaTemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WaHeaderFormat" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION');

-- CreateEnum
CREATE TYPE "WaButtonType" AS ENUM ('QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE');

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" "WaTemplateCategory" NOT NULL DEFAULT 'MARKETING',
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
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_templates_user_id_idx" ON "message_templates"("user_id");

-- CreateIndex
CREATE INDEX "message_templates_user_id_channel_idx" ON "message_templates"("user_id", "channel");

-- CreateIndex
CREATE INDEX "message_templates_user_id_status_idx" ON "message_templates"("user_id", "status");

-- CreateIndex
CREATE INDEX "message_templates_user_id_category_idx" ON "message_templates"("user_id", "category");

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
