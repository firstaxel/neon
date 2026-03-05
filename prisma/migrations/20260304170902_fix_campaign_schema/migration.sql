/*
  Warnings:

  - You are about to drop the column `message_id` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `sentBy` on the `messages` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[meta_message_id]` on the table `messages` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sentBy_fkey";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "message_id",
DROP COLUMN "sentBy",
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "from_number" TEXT,
ADD COLUMN     "meta_message_id" TEXT,
ADD COLUMN     "twilio_sid" TEXT;

-- CreateTable
CREATE TABLE "_MessageToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MessageToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_MessageToUser_B_index" ON "_MessageToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "messages_meta_message_id_key" ON "messages"("meta_message_id");

-- CreateIndex
CREATE INDEX "messages_meta_message_id_idx" ON "messages"("meta_message_id");

-- AddForeignKey
ALTER TABLE "_MessageToUser" ADD CONSTRAINT "_MessageToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageToUser" ADD CONSTRAINT "_MessageToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
