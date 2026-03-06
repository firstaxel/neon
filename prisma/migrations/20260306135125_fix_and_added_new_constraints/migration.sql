-- CreateIndex
CREATE INDEX "contacts_uploadedBy_idx" ON "contacts"("uploadedBy");

-- CreateIndex
CREATE INDEX "message_templates_user_id_purpose_idx" ON "message_templates"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "message_templates_created_at_idx" ON "message_templates"("created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_campaign_id_status_idx" ON "messages"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "parse_jobs_parsedBy_idx" ON "parse_jobs"("parsedBy");

-- CreateIndex
CREATE INDEX "transactions_campaign_id_idx" ON "transactions"("campaign_id");

-- CreateIndex
CREATE INDEX "transactions_wallet_id_created_at_idx" ON "transactions"("wallet_id", "created_at" DESC);
