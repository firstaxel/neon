/*
  Warnings:

  - You are about to drop the column `expires` on the `session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "session" DROP COLUMN "expires";
