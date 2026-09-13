-- CreateEnum
CREATE TYPE "ParseJobReviewStatus" AS ENUM ('pending_review', 'committed', 'dismissed');

-- AlterTable
ALTER TABLE "parse_jobs" ADD COLUMN     "candidates" JSONB,
ADD COLUMN     "review_status" "ParseJobReviewStatus" NOT NULL DEFAULT 'pending_review',
ADD COLUMN     "strategy" "ImportStrategy" NOT NULL DEFAULT 'skip_duplicates',
ADD COLUMN     "tags_applied" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "parse_jobs_review_status_idx" ON "parse_jobs"("review_status");
