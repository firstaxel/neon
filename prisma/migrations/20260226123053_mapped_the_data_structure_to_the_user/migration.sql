/*
  Warnings:

  - Added the required column `createdBy` to the `campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedBy` to the `contacts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sentBy` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parsedBy` to the `parse_jobs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "createdBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "uploadedBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "sentBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "parse_jobs" ADD COLUMN     "parsedBy" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "parse_jobs" ADD CONSTRAINT "parse_jobs_parsedBy_fkey" FOREIGN KEY ("parsedBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
