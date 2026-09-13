# Review, data-model, 2026-09-09

**Reviewed by**: Gemini 2.5 Pro (independent review subagent) (author on Gemini 2.5 Pro)
**Scope**: 16 files, branch vs base
**Verdict**: Blocked

## Summary
This change establishes a robust prepaid wallet system with Paystack checkout integration, database level balance constraints, and two phase campaign fund reservations. The transaction ledger and payment fee calculation logic protect platform unit economics while providing transparent pricing. However, a critical authorization vulnerability in deposit verification allows cross user wallet balance hijacking, pre flight campaign affordability checks omit held funds, and the payment webhook and hold reconciliation routines lack automated test coverage.

## Blockers
### 🔴 Missing tenant authorization check in verifyDeposit enables deposit balance hijacking, `src/features/billing/billing.router.ts:98`
**Problem**: The `verifyDeposit` procedure queries pending transactions solely by payment reference without verifying that the transaction belongs to the calling session user. Upon successful payment verification with Paystack, it invokes `creditWallet` passing the caller user identifier instead of the original transaction owner.
**Why it matters**: Any authenticated user who obtains or guesses another user pending deposit reference can trigger verification to credit the deposit amount to their own wallet balance. This mutates the victim transaction record to completed with the attacker balance, corrupts financial accounting, and deprives the paying customer of their purchased balance.
**Suggested fix**: Include the wallet relation when retrieving the transaction record and assert that `existing.wallet.userId === context.session.user.id`. Return an unauthorized or not found error when ownership does not match. Additionally, harden `creditWallet` in `src/features/billing/utils/index.ts` to assert that existing transactions match the destination wallet.

## Major
### 🟠 Pre flight campaign affordability ignores held funds causing unexpected dispatch failures, `src/features/billing/utils/index.ts:410`
**Problem**: Both `canAffordCampaign` in wallet utilities and `checkCampaignCost` in the billing router compare estimated message costs against total `wallet.balanceKobo` rather than spendable available funds calculated as `wallet.balanceKobo - wallet.heldKobo`.
**Why it matters**: Organizations with active campaigns holding reserved funds will receive a false positive confirmation indicating sufficient balance. When the user subsequently launches the broadcast, `holdCampaignFunds` rejects the reservation with an `INSUFFICIENT_BALANCE` error, resulting in broken user expectations and unexpected campaign aborts.
**Suggested fix**: Compute affordability by comparing total message costs against spendable available kobo (`Math.max(0, wallet.balanceKobo - wallet.heldKobo)`). Calculate shortfalls relative to spendable available funds and expose `availableKobo` in the procedure response.

### 🟠 Missing automated test coverage for payment webhooks and hold reconciliation, `src/routes/api/webhooks/paystack.ts:25`
**Problem**: Critical payment ingestion and background financial tasks operate without automated tests despite a configured test runner. `paystackWebhook` signature validation, gross amount matching, and duplicate event handling have no tests. In addition, the background cron `reconcileStaleCampaignHolds` in `src/features/jobs/functions/reconcile-holds.ts` and core database locking methods in `src/features/billing/utils/index.ts` lack test coverage.
**Why it matters**: Payment webhooks and automated hold cleanup handle live monetary balance updates. Uncovered regressions in HMAC signature verification, payload parsing, or hold reconciliation can silently drop incoming deposits or incorrectly alter organization balances.
**Suggested fix**: Create test suites for `paystackWebhook` exercising valid signatures, invalid signature rejections, payload amount mismatches, and idempotent replays. Add test coverage for `reconcileStaleCampaignHolds` to confirm stale terminal campaign holds are restored while active in progress dispatches remain protected.

## Minor
### 🟡 Inngest step memoization loses outer counter across execution replays, `src/features/jobs/functions/reconcile-holds.ts:33`
**Problem**: In `reconcileStaleCampaignHolds`, the accumulator `reconciledCount` is declared outside of Inngest steps and mutated inside `step.run`. When Inngest replays the function across multiple steps, previously completed step blocks are skipped and their internal mutations do not rerun.
**Why it matters**: The function return value reports inaccurate zero or partial reconciliation counts in Inngest observability logs whenever holds span across multiple wallet steps.
**Suggested fix**: Return the count of reconciled holds directly from each `step.run` invocation and aggregate the returned counts outside the steps.

### 🟡 Unhandled JSON parse exception on incoming webhook payloads, `src/routes/api/webhooks/paystack.ts:35`
**Problem**: `JSON.parse(rawBody)` is executed outside the `try catch` block in the Paystack webhook handler.
**Why it matters**: Malformed request bodies or empty test payloads with valid signatures will trigger an uncaught SyntaxError that crashes the server route with an unhandled HTTP 500 status instead of a handled response.
**Suggested fix**: Move `JSON.parse(rawBody)` inside the `try` block to ensure payload parse failures are caught and handled cleanly.

### 🟡 Campaign hold releases misclassified as credit transactions in ledger, `src/features/billing/utils/index.ts:277`
**Problem**: `releaseCampaignHold` creates transactions with `type: "campaign_refund"`, and `billing.router.ts` categorizes all `campaign_refund` records with `isCredit: true`.
**Why it matters**: Releasing an unspent campaign hold only decrements `heldKobo` without modifying `balanceKobo`. The transaction ledger and UI display these records as positive credit events with a green plus sign, misleading customers because their total balance remains unchanged.
**Suggested fix**: Differentiate cash balance refunds from hold clearance events in the transaction record, or set `isCredit` true only when `balanceAfterKobo` increases relative to the prior balance.

## Nits
* ⚪ `src/features/billing/utils/index.ts:40`, Code comments in `PRICING.PER_MESSAGE` state ₦2.50 for SMS and ₦9.00 for WhatsApp marketing, conflicting with actual kobo values of 600 (₦6.00) and 9000 (₦90.00).
* ⚪ `src/features/billing/views/billing-verify.tsx:263`, Redundant default export of `BillingVerifyView` flagged by Biome linter alongside existing named export.
* ⚪ `src/features/billing/views/billing-verify.tsx:78`, Redirect `setTimeout` timer is not cleared when component unmounts.
* ⚪ `src/features/billing/utils/index.ts:193`, Hold reference generation relies exclusively on `Date.now()` without random entropy, risking collisions during high concurrency.

## Strengths
* Database level PostgreSQL check constraints guarantee non negative wallet balance, non negative held funds, and positive transaction values.
* Row level write locking with `SELECT FOR UPDATE` serializes wallet balance updates and prevents race conditions between simultaneous webhooks and user callbacks.
* The customer pass through fee model transparently calculates Paystack fees and preserves messaging unit economics.

## Test coverage
The existing suite in `src/features/billing/billing.router.test.ts` validates deposit limits, mock fee calculations, and transaction retrieval. However, `src/routes/api/webhooks/paystack.ts` and `src/features/jobs/functions/reconcile-holds.ts` have zero automated tests. Real database transaction behavior, row level locking, and hold reconciliation in `src/features/billing/utils/index.ts` are fully mocked out and need dedicated integration coverage.

## Resolution (2026-09-09)
* ✅ **Tenant authorization in verifyDeposit enforced**: Included wallet relation and asserted `existing.wallet.userId === context.session.user.id`, returning `NOT_FOUND` on mismatch and passing `existing.wallet.userId` to `creditWallet`. Also hardened `creditWallet` to throw `TRANSACTION_WALLET_MISMATCH` if an existing transaction belongs to a different wallet.
* ✅ **Campaign affordability calculated against spendable available funds**: `canAffordCampaign` and `checkCampaignCost` now compare estimated costs against spendable available kobo (`Math.max(0, wallet.balanceKobo - wallet.heldKobo)`), correctly calculating shortfalls and exposing `availableKobo`.
* ✅ **Automated test suites implemented for payment webhooks, reconciliation cron, and utilities**: Created `src/features/payment/paystack/webhook.test.ts` exercising valid signatures, invalid signature rejections, malformed JSON bodies, payload mismatches, and idempotent replays. Created `src/features/jobs/functions/reconcile-holds.test.ts` asserting that active in progress campaigns remain untouched while terminal and deleted holds are cleared. Created `src/features/billing/utils/index.test.ts` covering spendable balance calculations and cross wallet attack prevention. All 86 test assertions across 16 test files pass cleanly.
* ✅ **Inngest step memoization counter resolved**: `reconcileStaleCampaignHolds` returns the reconciled count from each `step.run` invocation and aggregates the results outside steps, preserving accurate counts across replays. Replaced sequential await with `Promise.all`.
* ✅ **Malformed JSON webhook payloads caught gracefully**: Wrapped `JSON.parse` in a try catch block returning HTTP 400 Bad Request on invalid payloads.
* ✅ **Hold release transaction classification corrected**: Marked hold release transactions with `metadata.isHoldRelease: true`. In `billing.router.ts`, set `isCredit: false` and `isHoldRelease: true` for hold clearances, rendering an unlock icon and neutral formatting in `src/features/billing/views/billing-view.tsx`.
* ✅ **Pricing comments updated**: Synchronized code comments in `PRICING.PER_MESSAGE` with current kobo values (₦6.00 for SMS, ₦90.00 for WhatsApp marketing).
* ✅ **Redundant default export eliminated**: Removed `export default BillingVerifyView` and switched to named imports in route definition.
* ✅ **Timer cleanup in verification view**: Added timeout clearance in `useEffect` cleanup hook on component unmount.
* ✅ **Reference generation entropy added**: Appended random entropy to hold and release reference keys to avoid collisions.

