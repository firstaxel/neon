# 0009. Delivery analytics and campaign reports

**Date**: 2026-09-13
**Status**: Proposed

## Summary

This specification defines the delivery analytics and campaign reporting system for Velocast. It introduces real time delivery tracking, structured failure reason categorization, financial ledger audits, filterable recipient status logs, and streaming RFC 4180 compliant CSV exports for past and active broadcasts. Sourced directly from PostgreSQL via indexed Prisma aggregations and Sentry instrumentation, this feature provides complete operational transparency into campaign performance and kobo wallet deductions without adding external infrastructure.

## Context

Velocast dispatches high volume broadcasts across SMS and WhatsApp using Termii and Meta Cloud API. While earlier features established campaign dispatch and prepaid wallet deduction, operators currently lack deep visibility into post dispatch telemetry.

Several technical and operational forces shape this requirement:
1. Multi channel delivery divergence: SMS and WhatsApp possess fundamentally distinct delivery lifecycles. WhatsApp provides granular webhook events for sent, delivered, and read states, whereas SMS delivery confirmation depends on carrier network delivery receipts. Operators need clear comparative visibility across both channels to evaluate delivery performance and reachability.
2. Failure opacity: When messages fail, operators encounter raw or missing error logs. Without structured failure categorization such as invalid phone numbers, carrier network unreachability, Meta template policy rejections, or balance exhaustion, operators cannot distinguish contact data quality issues from provider outages.
3. Financial accountability: Broadcasts reserve funds via two phase wallet holds. Operators require an auditable financial breakdown showing initial estimated hold, final debited kobo, and unspent refunded kobo per broadcast to trust platform accounting.
4. Operational compliance: Organizations often need shareable proof of broadcast delivery for compliance, audit, or record keeping, necessitating structured CSV exports of recipient status logs.

Failing to build deep campaign analytics would leave operators unable to diagnose delivery drop offs, reconcile billing debits, or refine audience targeting.

## Requirements

**User stories**:
- As an organization operator, I want to inspect any broadcast to see verified delivery and read percentages so that I know how effectively my message reached recipients.
- As an organization operator, I want to see categorized failure reasons alongside raw provider errors so that I can clean invalid numbers and resolve delivery issues.
- As a finance manager, I want to see an exact breakdown of held funds, debited message costs, and unspent refunds so that our wallet transactions are fully auditable.
- As an administrator, I want to search, filter, and export the recipient delivery log to CSV so that I can retain offline records and share reports with leadership.

**Acceptance criteria**:
- **AC-1**: Campaign summary metrics: the system displays total recipients, queued count, sent count, confirmed delivered count, read count, failed count, delivery success rate percentage, and WhatsApp read rate percentage.
- **AC-2**: Dual channel comparative performance: when a broadcast targets both SMS and WhatsApp, delivery metrics, read rates, and median delivery latencies in seconds are broken down by channel independently.
- **AC-3**: Actionable failure categorization: message delivery failures are classified into distinct categories (invalid phone number, carrier network failure, Meta policy rejection, rate limit, system error, or unknown) with aggregate counts and individual recipient drill down.
- **AC-4**: Financial ledger audit: the report displays the initial campaign hold in kobo, total debited kobo on dispatch, refunded unspent kobo, average cost per delivered message, and linked wallet transaction records.
- **AC-5**: Recipient status log: a filterable, paginated recipient table supports filtering by message status (queued, sending, sent, delivered, read, failed), filtering by channel (SMS, WhatsApp), free text search across contact name and phone number, and inspection of error messages.
- **AC-6**: Streaming RFC 4180 CSV export: operators can download a complete CSV export of the recipient delivery log containing contact name, phone number, channel, delivery status, failure category, sent timestamp, delivered timestamp, read timestamp, segments count, and cost in kobo, streamed directly to prevent memory exhaustion.
- **AC-7**: Live telemetry refresh: metric cards and progress indicators automatically refresh via polling every 5 seconds while campaign status is dispatching or processing, stopping automatically when campaign status reaches completed, failed, or cancelled.

## Options considered

### Option 1: On demand PostgreSQL aggregations with structured failure codes (Chosen)

Compute all metrics, failure breakdowns, and financial summaries on demand from indexed `Message` and `Transaction` records in PostgreSQL. Extend the `Message` table with a structured `failureReason` enum populated during worker dispatch or webhook ingestion. Expose dedicated oRPC procedures for analytics summary and paginated recipient logs alongside an HTTP streaming export endpoint.

**Pros**:
- Single source of truth with zero cache synchronization drift or background roll up workers.
- Leveraging composite PostgreSQL indexes provides sub 15ms aggregation performance for standard broadcast sizes.
- Structured failure enums simplify client side rendering, filtering, and reporting.

**Cons**:
- Heavy aggregation queries on exceptionally massive broadcasts (100k+ messages) could increase database CPU utilization if not properly indexed.

### Option 2: Precomputed summary snapshot tables with background sync worker

Create a dedicated `CampaignAnalytics` table with precalculated aggregate counts. Maintain counters using Inngest background jobs or database triggers reacting to message status mutations.

**Pros**:
- Extremely fast read latency for summary metric counters.

**Cons**:
- High architectural complexity with eventual consistency lag and potential counter drift during concurrent webhook bursts.
- Requires dedicated reconciliation cron jobs to resolve discrepancies between message records and summary counters.

### Option 3: Client side memory aggregation from full message payloads

Fetch all message records for a campaign into browser memory via TanStack Query and compute percentages, failure categories, and financial sums on the client.

**Pros**:
- Minimal backend query logic required.

**Cons**:
- Catastrophic performance degradation and high memory consumption for broadcasts with thousands of recipients.
- Massive network payload transfer, especially on constrained mobile data connections.

## Decision

**Chosen option**: Option 1: On demand PostgreSQL aggregations with structured failure codes

We will compute campaign analytics on demand from indexed PostgreSQL records using Prisma `aggregate` and `groupBy` queries, extend `Message` with a structured `failureReason` enum, ingest Termii delivery report webhooks, map Meta and Termii errors to actionable categories, provide HTTP chunked CSV streaming, and expose separate procedures for metrics and paginated recipient logs.

**Implementation skills**: `tanstack-start` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-start/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `orpc` (`orpc/skills`, `.agents/skills/orpc/`)

## Rationale

Option 1 provides the optimal balance of immediate data accuracy, minimal moving parts, and rapid delivery under our Tracer Bullet approach. Velocast already stores every outbound dispatch in the `Message` table and records all financial deductions in the `Transaction` table. Adding a precomputed snapshot table (Option 2) introduces counter drift risk and event sequencing bugs, especially when Meta and Termii webhooks arrive concurrently with Inngest dispatch workers. Client side aggregation (Option 3) would overwhelm client devices and fail completely on larger lists.

By adding composite indexes on `Message (campaign_id, status, failure_reason)` and `Message (campaign_id, phone)` and leveraging PostgreSQL native aggregate functions, we achieve immediate calculation speed while preserving a single source of truth.

## Feature design

### Data model sketch

Extend the existing `Message` model in `prisma/schema.prisma` with a failure categorization enum:

```prisma
enum MessageFailureReason {
  invalid_number
  network_failure
  policy_rejection
  rate_limited
  system_error
  unknown
}

model Message {
  id              String                @id @default(uuid())
  campaignId      String                @map("campaign_id")
  campaign        Campaign              @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  contactId       String?               @map("contact_id")
  contactName     String                @map("contact_name")
  phone           String
  channel         MessageChannel
  message         String                @db.Text

  segments        Int                   @default(1)
  costKobo        Int?                  @map("cost_kobo")

  status          MessageStatus         @default(queued)
  failureReason   MessageFailureReason? @map("failure_reason")
  fromNumber      String?               @map("from_number")
  termiiMessageId String?               @unique @map("termii_message_id")
  metaMessageId   String?               @unique @map("meta_message_id")

  errorMessage    String?               @map("error_message")
  retryCount      Int                   @default(0) @map("retry_count")

  sentAt          DateTime?             @map("sent_at")
  deliveredAt     DateTime?             @map("delivered_at")
  readAt          DateTime?             @map("read_at")
  createdAt       DateTime              @default(now()) @map("created_at")

  @@index([campaignId])
  @@index([campaignId, status, failureReason])
  @@index([campaignId, channel])
  @@index([campaignId, phone])
  @@index([status])
  @@index([channel])
  @@index([termiiMessageId])
  @@index([metaMessageId])
  @@map("messages")
}
```

### Failure reason mapping matrix

Raw provider error payloads are mapped to `MessageFailureReason` values as follows:

| Provider | Raw Error / Status Code | Mapped Failure Reason | Description |
|---|---|---|---|
| Meta | 131047, 131021 | `invalid_number` | Re-engagement or non existent WhatsApp user |
| Meta | 131026, 131051, 131052, 131053 | `policy_rejection` | Template parameter mismatch, spam rejection, or policy restriction |
| Meta | 130429, 131048 | `rate_limited` | Cloud API throughput or spam rate limit exceeded |
| Meta | 131000, 131005, 131009, 131016 | `network_failure` | Service unavailable, handset unreachable, or timeout |
| Meta | HTTP 5xx or unclassified error | `system_error` | Meta server error or internal gateway failure |
| Termii | Invalid phone number / DND rejected | `invalid_number` | Number format invalid or recipient active on Do Not Disturb |
| Termii | Expired / unreachable network | `network_failure` | Recipient handset switched off or out of coverage |
| Termii | Balance insufficient / account inactive | `system_error` | Provider credit exhaustion or credential issue |
| Termii | Concurrency limit exceeded | `rate_limited` | Gateway rate limit reached |
| Both | Unrecognized string or code | `unknown` | Fallback classification |

### State transitions

A message moves through these states:
- Initial queue: `queued` (created in database before dispatch)
- Dispatch: `queued` -> `sending` -> `sent` (accepted by Termii or Meta)
- Success progression:
  - SMS: `sent` -> `delivered` (receipt confirmed via Termii DLR webhook)
  - WhatsApp: `sent` -> `delivered` (delivery webhook) -> `read` (read receipt webhook)
- Failure: `queued` or `sending` -> `failed` (provider HTTP error, unverified number, or DLR failure webhook, setting `failureReason`)

### API surface

| Endpoint / Procedure | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `campaigns.getAnalytics` | RPC / POST | `campaignId: string` | `summary: AnalyticsSummary`, `channelBreakdown: ChannelBreakdown`, `failureBreakdown: FailureItem[]`, `financialSummary: FinancialSummary` | Protected session | 404 not found, 403 forbidden |
| `campaigns.getRecipientLog` | RPC / POST | `campaignId: string`, `page: number`, `limit: number`, `channel?: MessageChannel`, `status?: MessageStatus`, `failureReason?: MessageFailureReason`, `search?: string` | `items: RecipientLogItem[]`, `total: number`, `page: number`, `totalPages: number` | Protected session | 404 not found, 403 forbidden, 400 validation |
| `GET /api/campaigns/:campaignId/export` | HTTP GET | `campaignId: string` in path, optional query filters | Streamed `text/csv` attachment with RFC 4180 headers | Protected session cookie | 401 unauthorized, 404 not found, 403 forbidden |
| `/api/webhooks/termii` | HTTP POST | Termii DLR payload (JSON), query param `token: string` | `{ received: true }` | Secret token query check | 401 unauthorized, 400 invalid payload |
| `/api/webhooks/whatsapp` (existing) | HTTP POST | Meta webhook status payload | `{ received: true }` | HMAC signature verification | 401 unauthorized, 400 invalid payload |

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| `getAnalytics` | Total recipients count | Computed from `prisma.message.count({ where: { campaignId } })` |
| `getAnalytics` | Sent, delivered, read, failed counts | Computed via `prisma.message.groupBy({ by: ['status'], where: { campaignId } })` |
| `getAnalytics` | Delivery success rate percentage | Derived: `total > 0 ? (delivered / total) * 100 : 0` |
| `getAnalytics` | WhatsApp read rate percentage | Derived: `waDelivered > 0 ? (waRead / waDelivered) * 100 : 0` |
| `getAnalytics` | Median delivery latency | Calculated in application layer as the median of `deliveredAt - sentAt` in seconds for confirmed messages |
| `getAnalytics` | Channel comparative breakdown | Computed from `prisma.message.groupBy({ by: ['channel', 'status'], where: { campaignId } })` |
| `getAnalytics` | Failure category breakdown | Computed from `prisma.message.groupBy({ by: ['failureReason'], where: { campaignId, status: 'failed' } })` |
| `getAnalytics` | Financial audit figures (held, debited, refunded) | Sourced from `prisma.transaction.findMany({ where: { campaignId, userId } })` summing types `campaign_hold`, `message_debit`, and `campaign_refund` |
| `getAnalytics` | Average cost per delivered message | Derived: `delivered > 0 ? Math.round(actualDebitedKobo / delivered) : 0` |
| `getAnalytics` | Linked wallet transactions list | Sourced from `prisma.transaction.findMany({ where: { campaignId, userId }, select: { id: true, type: true, amountKobo: true, reference: true, createdAt: true } })` |
| `getRecipientLog` | Recipient name, phone, channel, status, failure reason, timestamps | Sourced from `prisma.message.findMany({ where: { campaignId, ...filters, ...(search ? { OR: [{ contactName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) } })` |
| Streaming CSV export | Downloadable RFC 4180 CSV stream | Generated via HTTP GET route querying cursor batches and streaming formatted CSV chunks |
| Webhook Termii DLR | `deliveredAt`, `delivered` or `failed` status, `failureReason` | Ingested from Termii webhook callback matching `termiiMessageId` |

### Key invariants

1. Tenant isolation: Operators can only query analytics, recipient logs, and exports for campaigns owned by their active user ID (`campaign.userId === ctx.user.id`).
2. Calculation bounds: Delivery rate and read rate percentages are strictly bounded between 0.0% and 100.0%.
3. Financial ledger equilibrium: For any completed broadcast, `heldKobo` equals `actualDebitedKobo + refundedKobo`.
4. Structured failure reason requirement: Any message transitioning to `failed` status must assign a valid `MessageFailureReason`.
5. Webhook timing safety: Inbound Termii delivery receipts must verify the secret webhook query token using timing safe comparison before querying or mutating the database.
6. Polling guard: Automatic 5 second client polling halts as soon as `campaign.status` reaches `completed`, `failed`, or `cancelled`.

### Security model

- Procedure authorization: Both `campaigns.getAnalytics`, `campaigns.getRecipientLog`, and the streaming export route execute behind Better Auth session verification, enforcing `campaign.userId === ctx.user.id`.
- Webhook authorization: The Termii webhook endpoint `/api/webhooks/termii` authenticates inbound payloads using a pre shared secret token in the query string (`?token=TERMII_WEBHOOK_SECRET`) checked via `crypto.timingSafeEqual`.
- Audit telemetry: CSV export procedure and streaming execution is instrumented via Sentry `startSpan` with user ID and campaign ID tags for security audit logging.

### Configuration required

- `TERMII_WEBHOOK_SECRET`: Secret query token configured in the Termii console to authenticate incoming delivery status webhooks.

### Critical test scenarios

- Happy path analytics: Querying `campaigns.getAnalytics` returns exact counts for sent, delivered, read, and failed messages, correct delivery percentages, median latencies, channel metrics, and transaction ledger details, verifying **AC-1**, **AC-2**, and **AC-4**.
- Failure categorization drill down: Messages failed due to invalid numbers, network issues, or policy rejections are grouped into correct category counts using the mapping matrix and display properly in recipient logs, verifying **AC-3**.
- Recipient log filtering, search, and pagination: Querying `campaigns.getRecipientLog` filters accurately by status and channel with case insensitive search matches on contact name and phone number, verifying **AC-5**.
- Streaming CSV export generation: `GET /api/campaigns/:campaignId/export` produces a valid streaming RFC 4180 CSV containing all relevant columns and escaping special characters properly, verifying **AC-6**.
- Live polling termination: Active campaigns in dispatching status trigger automatic refetching every 5 seconds until reaching completed status, verifying **AC-7**.
- Cross tenant security check: Querying analytics or exports for another user's campaign returns an authorization error, verifying **AC-1** and **AC-5**.
- Termii DLR webhook receipt: Valid Termii webhook payload updates message delivery status and timestamp, while invalid tokens are rejected with 401 Unauthorized, verifying **AC-1** and **AC-3**.

## Build plan

Following our Tracer Bullet delivery approach, we will implement this feature as a thin end to end thread through every layer first, then thicken UI capabilities:

1. Create the database migration for `MessageFailureReason` enum, the `failureReason` column, and composite indexes `[campaignId, status, failureReason]` and `[campaignId, phone]`, satisfies **AC-3**, **AC-5**.
2. Implement the Termii delivery report webhook handler at `/api/webhooks/termii` with secret token verification and error mapping matrix integration, satisfies **AC-1**, **AC-3**.
3. Implement `campaigns.getAnalytics` procedure with Prisma aggregations, channel breakdown, failure grouping, financial transaction audit, and Sentry instrumentation, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**.
4. Implement `campaigns.getRecipientLog` procedure and streaming HTTP CSV export route `/api/campaigns/:campaignId/export` with offset pagination, filtering, search, and chunked streaming, satisfies **AC-5**, **AC-6**.
5. Upgrade the campaign detail UI in `src/features/campaigns/view/campaign-detail-view.tsx` with delivery rate meters, channel tabs, failure category breakdown cards, financial audit card, live polling, filterable recipient table, and CSV download button, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**.

## Consequences

**Positive**:
- Full delivery visibility: Operators know exactly what percentage of messages reached audience handsets and WhatsApp chats.
- Financial trust: Transparent ledger audit connects initial wallet holds, debited broadcast fees, and refunded unspent balances.
- Actionable contact hygiene: Categorized failure reasons allow operators to fix invalid phone numbers and understand delivery barriers.
- Fast performance and crash resilience: On demand indexed database queries avoid counter drift while streaming CSV prevents out of memory crashes.

**Negative / tradeoffs**:
- Termii SMS delivery receipts depend on Nigerian carrier DLR latency, meaning SMS delivery confirmations may lag dispatch by several minutes.
- Additional database index storage on the `messages` table.

**Neutral**:
- Requires configuring the Termii webhook URL in the Termii vendor dashboard.

## Follow-up

- [ ] Configure `TERMII_WEBHOOK_SECRET` in environment variables and set the callback URL in the Termii vendor portal.
- [ ] Proceed to design Feature 11 (Inbox and two way conversation thread) in spec 0010 once delivery analytics implementation is underway.
