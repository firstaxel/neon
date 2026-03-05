/*
  Warnings:

  - You are about to drop the column `createdBy` on the `campaigns` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `campaigns` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('marketing', 'utility_prescreen', 'sms_fallback');

-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_createdBy_fkey";

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "createdBy",
ADD COLUMN     "delivery_mode" "DeliveryMode" NOT NULL DEFAULT 'marketing',
ADD COLUMN     "user_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "campaigns_user_id_idx" ON "campaigns"("user_id");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
