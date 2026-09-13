-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('in_progress', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ImportStrategy" AS ENUM ('skip_duplicates', 'overwrite', 'tags_only');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "import_batch_id" TEXT,
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "contact_imports" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'in_progress',
    "strategy" "ImportStrategy" NOT NULL DEFAULT 'skip_duplicates',
    "total_rows" INTEGER NOT NULL,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "tags_applied" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_imports_owner_id_idx" ON "contact_imports"("owner_id");

-- CreateIndex
CREATE INDEX "contact_imports_status_idx" ON "contact_imports"("status");

-- CreateIndex
CREATE INDEX "contacts_import_batch_id_idx" ON "contacts"("import_batch_id");

-- AddForeignKey
ALTER TABLE "contact_imports" ADD CONSTRAINT "contact_imports_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "contact_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
