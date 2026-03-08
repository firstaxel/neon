-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "last_inbound_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scenario_id" TEXT;

-- CreateIndex
CREATE INDEX "message_templates_user_id_scenario_id_idx" ON "message_templates"("user_id", "scenario_id");

-- CreateIndex
CREATE INDEX "message_templates_user_id_scenario_id_is_default_idx" ON "message_templates"("user_id", "scenario_id", "is_default");
