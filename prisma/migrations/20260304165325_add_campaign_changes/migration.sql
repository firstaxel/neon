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

-- CreateIndex
CREATE INDEX "sender_numbers_user_id_channel_is_active_idx" ON "sender_numbers"("user_id", "channel", "is_active");

-- CreateIndex
CREATE INDEX "pending_deliveries_phone_idx" ON "pending_deliveries"("phone");

-- CreateIndex
CREATE INDEX "pending_deliveries_campaign_id_idx" ON "pending_deliveries"("campaign_id");

-- CreateIndex
CREATE INDEX "pending_deliveries_expires_at_idx" ON "pending_deliveries"("expires_at");

-- AddForeignKey
ALTER TABLE "sender_numbers" ADD CONSTRAINT "sender_numbers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_deliveries" ADD CONSTRAINT "pending_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
