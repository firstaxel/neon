-- AlterTable
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_paystack_ref_key" ON "transactions"("paystack_ref");

-- Check Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_balance_kobo_non_negative') THEN
    ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_kobo_non_negative" CHECK ("balance_kobo" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_held_kobo_non_negative') THEN
    ALTER TABLE "wallets" ADD CONSTRAINT "wallets_held_kobo_non_negative" CHECK ("held_kobo" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_balance_ge_held') THEN
    ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_ge_held" CHECK ("balance_kobo" >= "held_kobo");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_kobo_positive') THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_kobo_positive" CHECK ("amount_kobo" > 0);
  END IF;
END $$;
