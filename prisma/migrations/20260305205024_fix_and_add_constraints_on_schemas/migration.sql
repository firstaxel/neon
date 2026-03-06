/*
  Warnings:

  - A unique constraint covering the columns `[uploadedBy,phone]` on the table `contacts` will be added. If there are existing duplicate values, this will fail.

*/
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
CREATE UNIQUE INDEX "contacts_uploadedBy_phone_key" ON "contacts"("uploadedBy", "phone");

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
