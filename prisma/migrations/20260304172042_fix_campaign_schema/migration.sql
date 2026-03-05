-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "opted_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opted_out_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");
