-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "channel_target" TEXT NOT NULL DEFAULT 'smart',
ADD COLUMN     "template_id" TEXT,
ADD COLUMN     "template_params" JSONB,
ADD COLUMN     "wa_template_language" TEXT,
ADD COLUMN     "wa_template_name" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "read_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "campaigns_template_id_idx" ON "campaigns"("template_id");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
