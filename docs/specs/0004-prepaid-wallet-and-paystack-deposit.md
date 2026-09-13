# 0004. Prepaid Wallet and Paystack Deposit

**Date**: 2026-09-09
**Status**: In Progress

## Summary

This specification establishes prepaid wallet balance management and instant Paystack deposits for Velocast. Organizations fund their messaging balance in Nigerian naira via Paystack hosted checkout with deposit limits from ₦500 to ₦5,000,000. Payment gateway processing fees are added to the checkout total so the organization wallet is credited with the exact requested amount in spendable integer kobo. We implement timing safe webhook signature validation, currency and amount verification, database check constraints, serialized row level locking, exactly once credit protection, two phase broadcast campaign holds, and a clean transaction ledger, completely pruning legacy subscription artifacts.

## Context

Velocast is a multi channel broadcast and messaging platform designed for Nigerian organizations to reach their audiences via SMS through Termii and WhatsApp through Meta Cloud API. Sending messages carries clear marginal costs: SMS charges a flat rate per message segment, while WhatsApp charges distinct rates for utility, service, and marketing conversations.

To protect both our infrastructure and customer budgets, Velocast operates on a strict prepaid model. Organizations must maintain spendable funds before dispatching campaigns. While earlier prototypes included exploratory subscription code and basic billing stubs, the platform requires an authoritative, production grade financial system.

Several critical challenges must be resolved:

First, payment gateway callbacks and asynchronous webhooks can arrive simultaneously. If both the browser redirect callback and the Paystack webhook trigger balance updates without synchronization, customers could be credited twice for a single deposit.

Second, campaign dispatches involve large batches of recipients. A campaign launching to thousands of recipients requires reserving funds upfront so subsequent dispatches do not exceed available funds. If workers experience failure mid dispatch, orphaned holds must be reconciled and released.

Third, gateway processing fee handling must protect unit economics. Paystack charges 1.5 percent plus ₦100 (capped at ₦2,000). To avoid eroding message margins, payment processing fees are passed to the customer by adding the calculated fee to the checkout charge, ensuring the wallet receives exactly one hundred percent of the requested deposit in spendable kobo.

Fourth, floating point rounding errors in financial transactions can cause cumulative discrepancies. All calculations must use integer kobo (one naira equals one hundred kobo) with database level non negative check constraints and strict row level locking to ensure serialized ledger snapshots.

Finally, residual subscription interfaces, mock hooks, and unused plan tiers in the codebase confuse developers and clutter the billing user interface. We must establish a clean, durable implementation for prepaid deposits and transaction tracking.

## Requirements

**User stories**:
- As an organization owner, I want to top up my prepaid balance between ₦500 and ₦5,000,000 using Paystack so that I have spendable funds to launch SMS and WhatsApp campaigns.
- As an organization owner, I want gateway processing fees transparently added at checkout so that my wallet receives the exact deposit amount I requested.
- As an organization owner, I want to view my current available balance, reserved campaign funds, and a paginated transaction history so that I can audit every financial change.
- As a broadcast dispatcher, I want campaign funds reserved when a broadcast is queued and deducted upon dispatch so that in flight campaigns cannot exceed our balance.
- As an engineer, I want webhook processing and deposit verification to be strictly idempotent so that network retries never double credit a user wallet.

**Acceptance criteria**:
- **AC-1**: A user can initiate a deposit between ₦500 and ₦5,000,000 via `billing.initDeposit`, which calculates the Paystack fee, creates a pending `Transaction` record for the net deposit amount, and returns a checkout URL charging gross amount (deposit plus fee).
- **AC-2**: Upon completing payment, the user is redirected to `/billing/verify`, which calls `billing.verifyDeposit` to verify the payment reference with Paystack and display confirmation details.
- **AC-3**: The server route `POST /api/webhooks/paystack` validates incoming requests using timing safe HMAC SHA512 signature comparison against `PAYSTACK_SECRET_KEY` and processes `charge.success` events.
- **AC-4**: Concurrent execution of webhook events and user verification callbacks is strictly idempotent, utilizing atomic conditional database transactions with row level locking to ensure a deposit is credited exactly once.
- **AC-5**: All balances and transaction amounts are stored strictly as integer kobo, protected by database check constraints guaranteeing `balance_kobo >= 0`, `held_kobo >= 0`, and `balance_kobo >= held_kobo`.
- **AC-6**: The oRPC router exposes `getWallet`, `initDeposit`, `verifyDeposit`, `getTransactions`, and `checkCampaignCost`, with every procedure enforcing session authentication and tenant isolation.
- **AC-7**: The `/billing` dashboard displays spendable balance, held funds, quick deposit preset buttons, a custom deposit dialog with message coverage estimates and fee breakdown, and a paginated, filterable transaction ledger.
- **AC-8**: Wallet utilities support two phase broadcast holds (`campaign_hold`), atomically increasing `heldKobo` during campaign queuing, deducting spendable balance upon dispatch, and releasing unspent funds upon failure.
- **AC-9**: Legacy subscription UI tabs, mock subscription hooks, and unused recurring billing client functions are removed from the codebase.
- **AC-10**: Both webhook ingestion and callback verification assert that verified currency is NGN and verified charge matches the expected gross checkout amount, crediting the net deposit kobo to the wallet.
- **AC-11**: An Inngest background maintenance cron identifies stale campaign holds older than 24 hours and releases held funds back to available balance.

## Options considered

### Option 1: Two phase checkout with customer fee pass through and authoritative webhook (Chosen)

In this approach, the user selects a deposit amount between ₦500 and ₦5,000,000. The system calculates the Paystack processing fee and sets the gross checkout charge so that the net credited amount equals the requested deposit. The server webhook acts as the authoritative settlement channel, while the user redirect callback page provides immediate visual confirmation. Both paths run through an atomic database transaction with row level locking that guarantees exactly once crediting.

**Pros**:
- Preserves broadcast messaging margins by passing payment gateway fees to the checkout total.
- Users receive the exact clean deposit amount they requested in their wallet balance.
- Accommodates high volume broadcast campaigns with deposit ceiling raised to ₦5,000,000.
- Immediate visual confirmation upon redirect callback, with complete resilience against closed tabs via webhooks.
- Strict row level locking and conditional updates eliminate race conditions.

**Cons**:
- Users see a slightly higher total amount on the Paystack checkout screen due to the processing fee.

### Option 2: Platform fee absorption with lower deposit ceiling

Velocast absorbs the 1.5 percent gateway fee, keeping the checkout charge identical to the deposit amount, with deposit ceiling capped at ₦1,000,000.

**Pros**:
- Checkout amount matches the deposit amount exactly with no fee addition.

**Cons**:
- Platform absorbs up to ₦2,000 per deposit, eroding thin SMS and WhatsApp broadcast margins.
- Limits larger enterprise customers who need to fund larger broadcast campaigns at once.

### Option 3: Flat convenience fee model

Velocast charges a fixed flat convenience fee (such as ₦200) on all deposits regardless of transaction size.

**Pros**:
- Simple flat pricing communication.

**Cons**:
- Unfairly penalizes smaller deposits while under recovering gateway fees on large deposits.

## Decision

**Chosen option**: Option 1: Two phase checkout with customer fee pass through and authoritative webhook

We implement Paystack hosted checkout with deposit limits from ₦500 to ₦5,000,000. Paystack payment processing fees are added to the checkout total, crediting the user wallet with one hundred percent of the requested deposit in spendable kobo. Concurrency is guarded by row level database write locking.

**Implementation skills**: `prisma-client-api` (prisma/skills, .agents/skills/prisma-client-api/) · `orpc` (orpc/skills, .agents/skills/orpc/) · `tanstack-start` (tanstack-skills/tanstack-skills, .agents/skills/tanstack-start/) · `tanstack-query` (tanstack-skills/tanstack-skills, .agents/skills/tanstack-query/)

## Rationale

Option 1 delivers sustainable unit economics and transparent accounting. Message dispatch margins on SMS and WhatsApp are tight. Absorbing 1.5 percent payment processing fees on large campaign deposits degrades profitability. By passing the exact Paystack fee at checkout, organizations get full transparency, and their Velocast wallet balance displays the exact clean amount they budgeted.

Increasing the deposit ceiling from ₦1,000,000 to ₦5,000,000 accommodates organizations broadcasting to tens of thousands of members across Nigeria without requiring multiple consecutive top up transactions.

## Feature design

**Data model sketch**:

```prisma
enum TransactionType {
  deposit
  message_debit
  campaign_hold
  campaign_refund
  refund
}

enum TransactionStatus {
  pending
  completed
  failed
  reversed
}

model Wallet {
  id            String        @id @default(uuid())
  userId        String        @unique @map("user_id")
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  balanceKobo   Int           @default(0) @map("balance_kobo")
  heldKobo      Int           @default(0) @map("held_kobo")

  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  transactions  Transaction[]

  @@map("wallets")
}

model Transaction {
  id               String            @id @default(uuid())
  walletId         String            @map("wallet_id")
  wallet           Wallet            @relation(fields: [walletId], references: [id], onDelete: Cascade)

  type             TransactionType
  status           TransactionStatus @default(pending)

  amountKobo       Int               @map("amount_kobo")
  balanceAfterKobo Int               @map("balance_after_kobo")

  description      String
  reference        String            @unique
  paystackRef      String?           @unique @map("paystack_ref")
  metadata         Json?

  campaignId       String?           @map("campaign_id")
  messageId        String?           @map("message_id")

  createdAt        DateTime          @default(now()) @map("created_at")

  @@index([walletId])
  @@index([campaignId])
  @@index([walletId, createdAt(sort: Desc)])
  @@index([type])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("transactions")
}
```

Database constraints in PostgreSQL migration:
```sql
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_kobo_non_negative" CHECK ("balance_kobo" >= 0);
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_held_kobo_non_negative" CHECK ("held_kobo" >= 0);
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_ge_held" CHECK ("balance_kobo" >= "held_kobo");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_kobo_positive" CHECK ("amount_kobo" > 0);
```

**State transitions**:
- Deposit lifecycle: `pending` &rarr; `completed` (on successful verification or webhook) OR `pending` &rarr; `failed` (on payment cancellation, timeout, or Paystack decline).
- Campaign reservation lifecycle: Available funds &rarr; `heldKobo` increased with `campaign_hold` record &rarr; `message_debit` applied and hold cleared upon send OR unspent hold released with `campaign_refund` balance restoration upon failure.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `billing.getWallet` | oRPC Query | none | `balanceKobo`, `heldKobo`, `availableKobo`, `balanceFormatted`, `availableFormatted` | Session Protected | 401 Unauthorized |
| `billing.initDeposit` | oRPC Mutation | `amountNaira` (int, 500 to 5000000), `callbackUrl` (url) | `amountKobo`, `feeKobo`, `grossKobo`, `checkoutUrl`, `reference` | Session Protected | 400 Bad Request, 401 Unauthorized |
| `billing.verifyDeposit` | oRPC Mutation | `reference` (string) | `alreadyProcessed` (bool), `amountKobo` (int), `newBalanceKobo` (int), `newBalanceFormatted` (string) | Session Protected | 400 Bad Request, 404 Not Found |
| `billing.getTransactions` | oRPC Query | `page` (int, min 1), `pageSize` (int, 1 to 50), `type` (optional enum) | `pagination` (page, pageSize, total, totalPages), `transactions` (array) | Session Protected | 401 Unauthorized |
| `billing.checkCampaignCost` | oRPC Query | `contacts` (array of channel), `deliveryMode` (enum), `contactIds` (optional array) | `canAfford` (bool), `totalCostKobo` (int), `balanceKobo` (int), `shortfallKobo` (int) | Session Protected | 401 Unauthorized |
| `/api/webhooks/paystack` | HTTP POST | Paystack JSON payload, `x-paystack-signature` header | `{ received: true }` | Public (HMAC Verified) | 401 Unauthorized (bad signature) |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `initDeposit` | `reference` | Application generated string `dep_` concatenated with UUID v4 |
| `initDeposit` | `amountKobo` | Derived from user input `amountNaira * 100` |
| `initDeposit` | `feeKobo` | Calculated Paystack fee using standard Nigerian gateway fee formula |
| `initDeposit` | `grossKobo` | Computed as `amountKobo + feeKobo` charged on Paystack checkout |
| `initDeposit` | `checkoutUrl` | Paystack initialization response `data.authorization_url` |
| `verifyDeposit` | `amountKobo` | Read from pending `Transaction.amountKobo` after validating `data.amount === grossKobo` |
| `verifyDeposit` | `alreadyProcessed` | Checked from database `Transaction.status === 'completed'` |
| `verifyDeposit` | `newBalanceKobo` | Read from updated `Wallet.balanceKobo` after row level locked credit |
| `verifyDeposit` | `newBalanceFormatted` | Formatted via `Intl.NumberFormat` with Nigerian naira symbol |
| `getWallet` | `availableKobo` | Computed as `Math.max(0, wallet.balanceKobo - wallet.heldKobo)` |
| `getTransactions` | `pagination.total` | Concurrent count query via `context.db.transaction.count` |
| `getTransactions` | `pagination.totalPages` | Derived as `Math.ceil(total / pageSize)` |
| `checkCampaignCost` | `totalCostKobo` | Calculated from contact channels using `PRICING.PER_MESSAGE` constant |
| Webhook ingestion | `paystackRef` | Read from incoming webhook payload `data.reference` |
| Webhook ingestion | `metadata` | Captures fee breakdown, payment channel, and gateway response data |

**Fee Calculation Formula**:
```ts
export function calculatePaystackFee(netKobo: number): number {
  // Paystack Nigeria: 1.5% + N100 (waived under N2,500), capped at N2,000
  const flatFeeKobo = netKobo >= 250_000 ? 10_000 : 0;
  const rawFee = Math.round((netKobo + flatFeeKobo) / (1 - 0.015)) - netKobo;
  return Math.min(200_000, rawFee);
}
```

**Key invariants**:
- Available spendable balance equals `balanceKobo - heldKobo` and can never be negative.
- Deposit transactions record the net spendable amount in `amountKobo`, while the charged gross amount is recorded in transaction metadata.
- Wallet balances are credited with the exact net deposit amount requested by the organization.
- Row level write locking via `SELECT balance_kobo, held_kobo FROM wallets WHERE id = $1 FOR UPDATE` is required inside database transactions to ensure serialized ledger snapshots.
- A deposit reference can only transition from `pending` to `completed` once; duplicate attempts return the existing status without altering balances.
- The external `paystackRef` is unique, preventing reuse of an external payment reference across multiple transactions.
- Raw webhook payloads must pass timing safe HMAC SHA512 validation before accessing any database records.
- Verified payments must match currency `NGN` and gross amount to prevent checkout tampering.

**Security model**:
- All oRPC billing endpoints require an active session verified by server authentication middleware. The target `userId` is obtained strictly from `context.session.user.id`, never accepted as input.
- Database queries enforce tenant scoping by filtering on `userId` or `walletId` belonging to the authenticated user.
- The webhook endpoint `/api/webhooks/paystack` is public to receive external Paystack HTTP posts, but strictly guarded by timing safe HMAC signature verification using `crypto.timingSafeEqual`.
- Paystack secret keys are stored exclusively in environment variables on the server, never bundled into client assets.

**Configuration required**:
- `PAYSTACK_SECRET_KEY`: Secret API key for server side Paystack communication and webhook signature hashing.
- `VITE_PAYSTACK_PUBLIC_KEY`: Optional public key for client integration references.

**Critical test scenarios**:
- Happy path: User initiates a ₦10,000 deposit, checkout charges ₦10,254 (including fee), user completes payment, returns to `/billing/verify`, and sees their wallet credited by exactly 1,000,000 kobo (₦10,000), verifies **AC-1**, **AC-2**, **AC-5**.
- Deposit limits enforcement: Attempting to initiate a deposit under ₦500 or over ₦5,000,000 throws a validation error, verifies **AC-1**.
- Webhook delivery: Paystack sends a signed `charge.success` webhook, server validates HMAC signature, asserts currency NGN and matching gross amount, transitions pending transaction to completed, and credits net deposit amount, verifies **AC-3**, **AC-4**, **AC-5**, **AC-10**.
- Race condition handling: Browser callback and webhook arrive within milliseconds of each other; row level locking and conditional update ensure the wallet is credited exactly once, verifies **AC-4**.
- Amount mismatch rejection: Webhook payload containing an amount differing from expected gross charge is rejected and marked failed, verifies **AC-10**.
- Invalid webhook signature: Webhook request with an invalid or missing signature header is rejected with HTTP 401, verifies **AC-3**.
- Insufficient balance protection: Attempting to hold campaign funds exceeding available balance throws an error and leaves balances untouched, verifies **AC-5**, **AC-8**.
- Stale hold release: Inngest cron detects campaigns abandoned over 24 hours and restores held balance to spendable funds, verifies **AC-11**.
- Legacy subscription absence: Deprecated subscription procedures and UI elements do not exist in the billing router and view components, verifies **AC-6**, **AC-9**.

## Build plan

- [x] 1. Add PostgreSQL check constraints for non negative balances and positive transaction amounts, add unique index on `paystackRef`, and add optional `metadata` JSON column to `Transaction` model, satisfies **AC-5**, **AC-10**.
- [x] 2. Harden Paystack native client in `src/features/payment/paystack/index.ts` with fee calculation utility, strict error typing, input validation, and removal of dead subscription methods, satisfies **AC-1**, **AC-2**, **AC-9**.
- [x] 3. Refactor core wallet utilities in `src/features/billing/utils/index.ts` with row level locked atomic credits, gross amount and currency assertions, two phase campaign holds, hold releases, and error handling, satisfies **AC-4**, **AC-5**, **AC-8**, **AC-10**.
- [x] 4. Update `src/features/billing/billing.router.ts` to implement hardened `getWallet`, `initDeposit` (with ₦500 to ₦5,000,000 limits and fee calculation), `verifyDeposit`, `getTransactions`, and `checkCampaignCost` procedures with cache invalidation and count queries, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-6**, **AC-10**.
- [x] 5. Harden webhook endpoint in `src/routes/api/webhooks/paystack.ts` with timing safe HMAC verification, gross amount matching, and atomic idempotent net crediting, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-10**.
- [x] 6. Implement Inngest cron job in `src/features/jobs/reconcile-holds.ts` to sweep and release stale campaign holds older than 24 hours, satisfies **AC-11**.
- [x] 7. Polish verification view in `src/features/billing/views/billing-verify.tsx` to handle success, already processed, and error states cleanly, satisfies **AC-2**, **AC-4**.
- [x] 8. Overhaul billing dashboard in `src/features/billing/views/billing-view.tsx` and hooks in `use-billing.ts` to remove deprecated subscription tabs, showcasing spendable balance, held funds, quick presets, custom deposit modal with fee preview, and paginated transaction ledger, satisfies **AC-7**, **AC-9**.
- [x] 9. Write comprehensive automated unit and integration tests in `src/features/billing/billing.router.test.ts` covering deposit initiation with fee calculation, verification, race condition immunity, hold mechanics, and transaction pagination, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**.

## Consequences

**Positive**:
- Eliminates duplicate crediting risks through atomic conditional database transactions with row level write locking.
- Protects platform margins by passing gateway fees to the checkout charge.
- Keeps wallet accounting clean by crediting the exact requested deposit amount in integer kobo.
- Accommodates high volume organizational broadcasts up to ₦5,000,000 per deposit.
- Blocks payment tampering by validating incoming webhook amount and currency against database expectations.
- Guarantees external Paystack references cannot be reused via unique constraints.
- Enables safe broadcast campaigns by reserving funds in advance through two phase holds and automated stale hold recovery.
- Removes deprecated subscription debt, aligning code and UI with the core product truth.

**Negative / tradeoffs**:
- Customers pay the Paystack fee on top of their deposit amount at checkout.
- Paystack hosted checkout involves a full page navigation away from the application, requiring state recovery upon redirect.
- Requires maintaining `PAYSTACK_SECRET_KEY` in deployment environments.

**Neutral**:
- Webhook endpoint must remain publicly accessible to Paystack IP ranges and requires HMAC validation on every incoming request.

## Follow-up

- [ ] Verify that `PAYSTACK_SECRET_KEY` is configured in production deployment secrets before opening customer deposits.
