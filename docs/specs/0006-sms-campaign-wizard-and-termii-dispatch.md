# 0006. SMS Campaign Wizard and Termii Dispatch

**Date**: 2026-09-10
**Status**: Accepted

## Summary

This specification defines the SMS campaign creation wizard and Termii broadcast dispatch system for Velocast. Users select contacts by tags, audience filters, or individual picks, compose personalized messages with dynamic placeholders (such as contact names and organization details), and inspect live GSM segment calculations before sending. The backend verifies spendable wallet balance, places a two phase hold on the estimated kobo amount, and schedules or immediately fans out delivery jobs through Inngest to the Termii SMS gateway. Message dispatches respect Nigerian telecom regulations, append required opt out instructions, handle partial delivery failures cleanly, and reconcile wallet deductions upon completion.

## Context

Velocast enables Nigerian organizations, churches, schools, and businesses to broadcast high priority outreach messages directly to their communities. While WhatsApp templates require prior Meta review and approval, SMS provides a universal delivery channel with immediate reach across all mobile devices regardless of smartphone ownership or internet data access.

Launching bulk SMS broadcasts introduces several technical and financial challenges. First, Nigerian telecom operators charge per message segment. A standard message encoded in the GSM 7 character set permits up to 160 characters for a single segment, but splits into 153 character segments when exceeded. Messages containing non Latin characters (such as emojis or smart quotes) force Unicode encoding, shrinking segments to 70 characters for a single message and 67 characters for multi part messages. Because dynamic placeholders like contact names vary in length, an estimate calculated on template text alone risks under holding funds if long recipient names push messages across segment boundaries.

Second, SMS broadcasts must protect user finances and infrastructure stability. A campaign targeting thousands of contacts requires an immediate hold on prepaid wallet funds so that subsequent actions do not overdraft the account. If some numbers fail due to invalid formats or network rejections, the system must debit only successful deliveries and return unspent funds. Furthermore, dispatching thousands of HTTP requests to Termii simultaneously risks triggering provider rate limits, necessitating structured background job queuing and throttled concurrency.

Finally, Nigerian telecommunications regulations mandate clear sender identification and opt out notices. Every promotional SMS must provide an explicit opt out instruction (such as "Reply STOP to opt out") and utilize approved sender identification to bypass Do Not Disturb filters.

## Requirements

**User stories**:
- As a campaign manager, I want to filter contacts by tags and choose individual recipients so that I can target specific segments of my audience.
- As a campaign manager, I want to view live character counts and GSM segment calculations so that I understand my broadcast costs before launching.
- As a campaign manager, I want dynamic placeholders to populate contact names and organization details automatically, falling back gracefully when details are absent, while prompting me for missing custom variables.
- As an organization owner, I want my wallet balance safely reserved upfront based on maximum potential segments and adjusted on completion so that I only pay for messages that actually dispatch.
- As a campaign manager, I want the option to schedule a campaign for future delivery or send immediately, with the ability to cancel before dispatch begins.

**Acceptance criteria**:
- **AC-1**: The wizard allows users to filter audience by contact tags, toggle individual contacts, or select all matching contacts via audience criteria, while automatically deduplicating recipients by normalized Nigerian E.164 phone numbers (converting local `080...` prefixes to `23480...`) so no contact receives duplicate messages in a single campaign.
- **AC-2**: Users can select an existing saved scenario template or compose a custom one time message, with real time preview updated as content changes.
- **AC-3**: Dynamic placeholders (contact name, phone number, and organization name) resolve automatically with a default fallback to "Friend" for missing names, and the wizard displays input fields for any manual campaign variables found in the template text (such as date or venue) before allowing launch.
- **AC-4**: A real time segment calculator analyzes character length, appends the regulatory 24 character opt out notice ("\n\nReply STOP to opt out") into character calculations, detects GSM 7 versus Unicode character encoding, calculates billable segments (160 single or 153 multi part for GSM 7; 70 single or 67 multi part for Unicode), and displays the estimated total cost in kobo and naira.
- **AC-5**: Cost estimation evaluates maximum potential segment expansion across chosen contacts, asserting that the spendable wallet balance (wallet balance minus existing held funds) covers the maximum potential cost, blocking submission and presenting an inline top up action when funds are insufficient.
- **AC-6**: Launching a campaign reserves the estimated total cost via a row level locked two phase wallet hold (`campaign_hold`), creates the campaign record in `pending` status, and initiates dispatch.
- **AC-7**: Users can choose immediate dispatch or specify a future date and time (`scheduledAt`), where scheduled campaigns place the wallet hold immediately and wait inside Inngest until the target timestamp.
- **AC-8**: Users can cancel a scheduled campaign before dispatch begins, which transitions the campaign to `cancelled` and immediately releases the reserved wallet hold back to spendable balance.
- **AC-9**: The backend dispatches campaigns using a two tier Inngest fan out pattern, where an orchestrator function queries recipient IDs in batches of 100, atomically marks campaign status as `dispatching` to prevent cancellation race conditions, and emits individual send events processed by concurrency limited workers.
- **AC-10**: The dispatch worker delivers messages via Termii using the registered organization sender ID, records individual message status and Termii message reference, appends required opt out notices, and reconciles final wallet debits and unspent hold refunds upon campaign completion.

## Options considered

### Option 1: Two Tier Inngest Fan Out with Two Phase Wallet Holds (Chosen)

An orchestrator Inngest function batches recipient contact IDs into chunks of 100, emitting child events for individual message workers. Outbound calls to Termii are rate limited and throttled through Inngest flow control. Wallet balance is reserved upfront with a `campaign_hold` record sized to cover worst case segment expansion across the audience. An orchestrator completion step calculates exact sent costs, debits the spendable balance with a `message_debit`, and returns any unspent hold.

**Pros**:
- Handles audiences of thousands safely within event payload limits by chunking recipient IDs and supporting audience filter queries.
- Prevents double spending and overdrafts through serialized row level locking and safe upper bound hold calculations.
- Eliminates cancellation race conditions through atomic status checks before fanning out worker jobs.
- Retries transient network failures without duplicating debits or message dispatches.

**Cons**:
- Requires coordinating between orchestrator and worker events.

### Option 2: Monolithic Inngest Function with Sequential Batches

A single Inngest function iterates through contacts in sequential loops of 50, calling Termii directly within `step.run` blocks until all recipients are processed.

**Pros**:
- Simpler architecture with only one Inngest function definition.

**Cons**:
- Prolongs execution duration for large campaigns, risking Inngest function timeout limits.
- Lacks granular per recipient concurrency controls and makes partial retries clumsy.

### Option 3: Direct Synchronous Request Loop in oRPC Handler

The web server initiates a loop over selected contacts directly inside the HTTP request handler, sending SMS messages synchronously to Termii before returning a response.

**Pros**:
- Minimal architectural overhead with no background queue requirement.

**Cons**:
- Fails catastrophically for campaigns larger than a few contacts due to HTTP connection timeouts.
- Offers no automatic recovery if the web server restarts during dispatch.

## Decision

**Chosen option**: Option 1: Two Tier Inngest Fan Out with Two Phase Wallet Holds

We implement the two tier Inngest fan out architecture combined with serialized two phase wallet holds. This ensures high throughput without exceeding Termii rate limits, keeps event payloads lightweight, and guarantees financial correctness for both immediate and scheduled broadcasts.

**Implementation skills**: `tanstack-start` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-start/`) · `tanstack-form` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-form/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `inngest-durable-functions` (`inngest/inngest-skills`, `.agents/skills/inngest-durable-functions/`) · `orpc` (`orpc/skills`, `.agents/skills/orpc/`)

## Rationale

Bulk messaging directly touches customer money and external carrier networks. If a worker process fails mid broadcast, or if a user triggers two campaigns in rapid succession, a naive system will either overbill or dispatch duplicate texts. Option 1 solves this by decoupling the submission from the execution. The HTTP endpoint performs input validation, audience deduplication, and atomic wallet reservation within a single database transaction, returning an immediate response to the user. The Inngest orchestrator divides the workload into manageable batches, allowing individual message workers to execute concurrently under strict rate limiting. This architecture matches our existing wallet hold mechanisms established in spec 0004 and scales cleanly to large contact directories.

## Feature design

**Data model sketch**:

```prisma
model Campaign {
  id                String            @id @default(uuid())
  userId            String            @map("user_id")
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  name              String?
  scenario          Scenario
  status            JobStatus         @default(pending)
  deliveryMode      DeliveryMode      @default(marketing) @map("delivery_mode")
  senderId          String?           @map("sender_id")

  whatsappTemplate  String            @map("whatsapp_template") @db.Text
  smsTemplate       String            @map("sms_template") @db.Text
  useCustomTemplate Boolean           @default(false) @map("use_custom_template")

  totalMessages     Int               @default(0) @map("total_messages")
  sentMessages      Int               @default(0) @map("sent_messages")
  failedMessages    Int               @default(0) @map("failed_messages")
  estimatedCostKobo Int               @default(0) @map("estimated_cost_kobo")

  inngestEventId    String?           @map("inngest_event_id")

  scheduledAt       DateTime?         @map("scheduled_at")
  createdAt         DateTime          @default(now()) @map("created_at")
  startedAt         DateTime?         @map("started_at")
  completedAt       DateTime?         @map("completed_at")

  messages          Message[]
  transactions      Transaction[]

  @@index([userId])
  @@index([status])
  @@index([scheduledAt])
  @@index([createdAt(sort: Desc)])
  @@map("campaigns")
}

model Message {
  id              String         @id @default(uuid())
  campaignId      String         @map("campaign_id")
  campaign        Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  contactId       String?        @map("contact_id")
  contactName     String         @map("contact_name")
  phone           String
  channel         MessageChannel
  message         String         @db.Text

  segments        Int            @default(1)
  costKobo        Int?           @map("cost_kobo")

  status          MessageStatus  @default(queued)
  fromNumber      String?        @map("from_number")
  termiiMessageId String?        @unique @map("termii_message_id")

  errorMessage    String?        @map("error_message")
  retryCount      Int            @default(0) @map("retry_count")

  sentAt          DateTime?      @map("sent_at")
  deliveredAt     DateTime?      @map("delivered_at")
  createdAt       DateTime       @default(now()) @map("created_at")

  @@index([campaignId])
  @@index([campaignId, status])
  @@index([phone])
  @@map("messages")
}
```

**State transitions**:
- Campaign lifecycle: `pending` (initial or waiting for schedule) &rarr; `dispatching` (worker active) &rarr; `completed` (all contacts processed) OR `failed` (system error) OR `cancelled` (user cancelled scheduled broadcast before launch).
- Message lifecycle: `queued` &rarr; `sent` (Termii accepted message) OR `failed` (rejected by network or provider).

**API surface**:

| Procedure | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `campaigns.estimateCost` | POST | `messageText: string`, `contactIds?: string[]`, `audienceFilter?: { tagIds?: string[], all?: boolean }`, `templateVars?: Record<string, string>` | `totalContacts: number`, `encoding: string`, `baseSegments: number`, `maxSegments: number`, `characterCount: number`, `costPerSegmentKobo: number`, `totalEstimatedCostKobo: number`, `availableBalanceKobo: number`, `sufficientBalance: boolean` | protected | 400 invalid inputs, 401 unauthorized |
| `campaigns.createSmsCampaign` | POST | `name?: string`, `scenario: Scenario`, `messageText: string`, `contactIds?: string[]`, `audienceFilter?: { tagIds?: string[], all?: boolean }`, `senderId?: string`, `scheduledAt?: string`, `templateVars?: Record<string, string>` | `campaignId: string`, `status: string`, `totalMessages: number`, `heldKobo: number`, `scheduledAt: string (nullable)` | protected | 400 insufficient funds or invalid contacts, 401 unauthorized, 409 duplicate submission |
| `campaigns.cancelScheduledCampaign` | POST | `campaignId: string` | `campaignId: string`, `status: string`, `releasedKobo: number` | protected | 400 not in pending status, 401 unauthorized, 404 not found |
| `campaigns.getCampaignDetail` | GET | `campaignId: string` | `campaign: object`, `progress: object`, `recentMessages: array` | protected | 401 unauthorized, 404 not found |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| `estimateCost` | `characterCount` | Computed from `messageText` string length plus 24 character opt out notice |
| `estimateCost` | `encoding` | Evaluated against GSM 7 standard alphabet (returns GSM 7 or Unicode) |
| `estimateCost` | `maxSegments` | Derived by sampling recipient names to find the longest potential segment count |
| `estimateCost` | `totalEstimatedCostKobo` | Derived as `totalContacts * maxSegments * PRICING.PER_MESSAGE.sms` (600 kobo) |
| `estimateCost` | `availableBalanceKobo` | DB query `wallet.balanceKobo - wallet.heldKobo` |
| `createSmsCampaign` | `senderId` | User selected profile sender ID, or fallback to system sender ID |
| `createSmsCampaign` | `heldKobo` | Computed from estimated cost and saved via `holdCampaignFunds` |
| `sendWorker` | `to` phone | Extracted from `Contact.phone` and normalized to E.164 without plus sign (`234...`) |
| `sendWorker` | `sms` body | Generated via `personalizeMessage(template, contact, templateVars)` with fallback to "Friend" for missing names, plus opt out notice |

**Key invariants**:
- Spendable balance check: a campaign can only be queued if `wallet.balanceKobo - wallet.heldKobo >= estimatedCostKobo`.
- Deduplication: every phone number appears at most once in a campaign message set.
- Reversible reservation: any unspent hold from failed messages, segment differences, or cancelled schedules must be released back to spendable balance.
- Opt out inclusion: every outbound SMS contains the regulatory opt out instructions ("Reply STOP to opt out") included in character segment calculations.
- Atomic state transition: Inngest orchestrator verifies `status === 'pending'` and sets `status = 'dispatching'` in a single query before fanning out, preventing cancellation race conditions.

**Security model**:
- Protected procedures: all campaign endpoints require an active authenticated user session.
- Tenant isolation: recipient contact IDs are checked against `Contact.userId = session.user.id`. Any contact belonging to another account is rejected.
- Provider credential security: `TERMII_API_KEY` is kept server side in environment variables, never sent to the browser.

**Configuration required**:
- `TERMII_API_KEY`: API secret for authenticating requests to Termii messaging endpoints.
- `TERMII_SENDER_ID`: Default registered alphanumeric sender identity for SMS broadcast headers.

**Critical test scenarios**:
- Happy path: User filters contacts by tag, composes SMS with `{{name}}` placeholder, verifies segment counter, launches campaign, wallet holds funds, Inngest workers dispatch via Termii, and balance reconciles, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-9**, **AC-10**.
- Insufficient balance: User attempts to launch campaign whose cost exceeds spendable funds; procedure throws insufficient balance error and leaves wallet balances unchanged, verifies **AC-5**.
- Unicode segment escalation: User enters a single emoji or non GSM quote character; segment counter immediately switches to Unicode (70 characters per segment), verifies **AC-4**.
- Scheduled campaign and cancellation: User schedules broadcast for tomorrow morning; wallet funds are held; user cancels later today; hold is restored and campaign marked cancelled without sending messages, verifies **AC-7**, **AC-8**.
- Partial provider failure: Out of 100 contacts, 5 fail due to invalid carrier numbers; worker records 5 failures and 95 successes; orchestrator debits 95 messages and refunds the 5 unspent message holds, verifies **AC-10**.
- Variable length segment boundary safety: Recipient with a long name pushes message over 160 characters into 2 segments; hold covers the upper bound, and actual debits match true sent segments, verifies **AC-4**, **AC-5**, **AC-10**.

## Build plan

Following our project Tracer Bullet approach, we construct a thin end to end thread through all layers (segment math &rarr; database hold &rarr; procedure &rarr; Inngest queue &rarr; Termii dispatch &rarr; wizard UI) before thickening edge cases and UI polish.

1. [x] Implement GSM 7 character set analyzer and segment calculator utility with opt out accounting in `src/lib/sms.ts`, satisfies **AC-4**
2. [x] Update database schema with migration adding `name`, `scheduledAt`, and `estimatedCostKobo` to `Campaign`, and `segments`, `costKobo` to `Message`, satisfies **AC-1**, **AC-6**, **AC-7**, **AC-10**
3. [x] Create server procedures in `src/features/campaigns/router/index.ts` for cost estimation, campaign creation with atomic wallet hold and audience filter resolution, and scheduled campaign cancellation, satisfies **AC-1**, **AC-3**, **AC-5**, **AC-6**, **AC-7**, **AC-10**
4. [x] Refactor Inngest campaign orchestrator and worker in `src/features/jobs/functions/send-campaign.ts` with two tier batching, atomic state claim to prevent cancellation race conditions, scheduled execution support via `step.sleepUntil`, and partial failure refund reconciliation, satisfies **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**
5. [x] Build multi step frontend campaign wizard in `src/features/campaigns/components/campaign-wizard.tsx` with contact tag filtering and audience deduplication, satisfies **AC-1**
6. [x] Implement wizard message editor with scenario template selection, manual variable input resolution with "Friend" fallback for missing names, and live GSM segment breakdown badges, satisfies **AC-2**, **AC-3**, **AC-4**
7. [x] Integrate wallet check, inline Paystack deposit trigger, and scheduling date picker into wizard review step, satisfies **AC-5**, **AC-6**, **AC-7**
8. [x] Write comprehensive automated unit and integration tests covering GSM calculations, wallet hold mechanics, scheduled cancellation, variable length segment boundaries, and partial refund handling, satisfies **AC-1**, **AC-4**, **AC-5**, **AC-7**, **AC-8**, **AC-10**

## Consequences

**Positive**:
- Users gain transparent, real time insight into SMS segment costs and character encoding before spending money.
- Two phase holds based on upper bound segment checks eliminate the risk of under holding funds or negative wallet balances.
- Two tier Inngest fan out protects third party provider rate limits while scaling to large recipient lists.
- Scheduled sending allows businesses to prepare campaigns during working hours for evening or weekend delivery.

**Negative / tradeoffs**:
- Scheduled campaigns lock wallet balance until execution or cancellation, reducing spendable funds for other broadcasts.
- Automatic inclusion of opt out text consumes approximately 24 characters of the first GSM segment.

**Neutral**:
- Requires existing Termii sender ID registration to ensure high local delivery rates.

## Follow-up

- [ ] Update `src/features/jobs/AGENTS.md` with Inngest campaign worker concurrency and rate limiting conventions.
- [ ] Monitor Termii delivery webhook latency to evaluate migrating from polled status updates to real time inbound DLR webhooks in Slice 2.
