# 0010. Inbox and two way conversation thread

**Date**: 2026-09-13
**Status**: Proposed

## Summary

This specification defines the centralized inbox and two way customer messaging system for Velocast. It introduces unified conversation threads per contact, automatic synchronization of incoming WhatsApp customer replies, an adaptive 24 hour Meta customer service window with live countdown, direct operator reply dispatching, and thread resolution management. Sourced directly from PostgreSQL via a dedicated ConversationThread model and synchronous Meta Cloud API dispatch, this feature turns Velocast from a one directional broadcast utility into an interactive customer engagement platform.

## Context

Velocast enables organizations to dispatch bulk SMS and WhatsApp outreach campaigns. However, customer communication in Nigeria is inherently conversational: recipients frequently reply to broadcast messages with inquiries, scheduling confirmations, prayer requests, or feedback.

Several technical and operational forces govern this domain:
1. Meta 24 hour customer service window rules: Meta strictly regulates outbound WhatsApp messaging. When a customer sends an inbound message, a 24 hour customer service window opens. During this active window, businesses can reply with freeform direct text messages without template restrictions and without per template marketing fees. Once this 24 hour window lapses, businesses can only re engage the customer using pre approved WhatsApp utility or marketing templates. Operators need clear visual indicators of window status to communicate effectively.
2. Channel capabilities: Currently, WhatsApp provides rich two way webhook communication. Termii SMS in this setup does not support incoming SMS response ingestion, though provider support may evolve in the future. The architecture must actively power WhatsApp two way messaging while isolating channel logic so SMS conversation replies can be enabled later without redesign.
3. Thread fragmentation: Prior to this feature, incoming customer replies were saved as raw, disconnected InboundMessage rows, and outbound campaign messages were stored separately under Campaign records. Operators had no unified timeline showing what was broadcast to a customer alongside what the customer replied.
4. Operational triage: Organizations receiving hundreds of replies require conversation organization: identifying unread messages, clearing unread counters upon review, and marking threads as resolved when inquiries are settled.

Without a centralized inbox, customer inquiries go unanswered, degrading audience engagement and wasting the conversational value of WhatsApp outreach.

## Requirements

**User stories**:
- As an organization operator, I want to see a unified inbox of all customer conversation threads so that I can monitor audience responses across my broadcasts.
- As an operator, I want to open any conversation thread to view the chronological history of broadcast messages and customer replies in a single timeline.
- As an operator, I want to see a live countdown of the 24 hour Meta customer service window so that I know whether I can send a freeform reply or must select an approved template.
- As an operator, I want to type and send direct WhatsApp replies immediately from the inbox with instant delivery status updates.
- As an operator, I want to mark conversations as resolved or reopen them so that our team can track which inquiries have been handled.
- As an operator, I want incoming customer replies from unknown phone numbers to display cleanly with a one click option to add them to my address book.

**Acceptance criteria**:
- **AC-1**: Centralized thread list: the inbox renders a paginated list of conversation threads sorted by most recent message, displaying contact name (or formatted phone number), channel badge, latest message snippet, relative timestamp, and unread reply count badge.
- **AC-2**: Unified chronological message timeline: selecting a thread loads a paginated message stream (latest 50 messages default) merging past outbound broadcast and direct messages (`Message`) with incoming customer replies (`InboundMessage`), indicating message direction, delivery status (sent, delivered, read, failed), and timestamps.
- **AC-3**: Adaptive 24 hour Meta service window: the interface inspects `thread.lastInboundAt` and displays an active customer care indicator with remaining time countdown when within 24 hours of the customer's last message; if expired or absent, freeform input is disabled and the operator is prompted to select an approved WhatsApp template.
- **AC-4**: Direct WhatsApp operator reply dispatch: typing a freeform reply within an active window and clicking send dispatches the message synchronously via Meta Cloud API, creates an outbound `Message` record linked to the thread, marks prior inbound messages as replied, and immediately updates the timeline.
- **AC-5**: Template reply fallback outside window: when the 24 hour window is expired, the operator can pick an approved WhatsApp template from a modal picker, fill required variables, and dispatch via Meta, re opening conversation history with the customer and debiting standard template fees.
- **AC-6**: Real time inbox synchronization: the inbox sidebar polls every 10 seconds and the active message timeline polls every 4 seconds while the browser tab is focused, updating unread counts and displaying new incoming messages without manual page reloads.
- **AC-7**: Conversation status management: operators can toggle conversation status between `open` and `resolved`, filter the thread list by status (`open`, `resolved`, `all`), and mark threads as read.
- **AC-8**: Unknown contact enrollment: incoming replies from numbers not enrolled in the `Contact` address book display an Add to Contacts button in the thread header, allowing rapid contact creation and instant thread linkage.
- **AC-9**: Channel abstraction: database models and API procedures structure channel parameters generically (`whatsapp` active, `sms` outbound only) so inbound SMS handling can be activated upon provider support without breaking existing thread structures.

## Options considered

### Option 1: Dedicated ConversationThread model with optional Message campaignId (Chosen)

Introduce an explicit `ConversationThread` table in PostgreSQL to manage thread state, unread counters, and resolution status. Store `lastInboundAt` directly on `ConversationThread` so window calculation works identically for known contacts and unknown callers. Make `Message.campaignId` optional and add `threadId` to both `Message` and `InboundMessage`. Dispatches within the inbox call Meta Cloud API synchronously and record outbound `Message` rows.

**Pros**:
- High query performance: thread list queries read indexed `ConversationThread` records directly without expensive dynamic group by joins across millions of message rows.
- Single unified message model: outbound direct replies reuse the existing `Message` table with all its delivery status tracking, failure reasons, and webhook reconciliation logic.
- Clean separation of concerns: thread resolution status, window timer, and unread counters live in a dedicated domain entity.

**Cons**:
- Requires a schema migration to make `Message.campaignId` nullable and create foreign key relations.

### Option 2: Dynamic runtime aggregation without a thread table

Compute conversation threads on the fly by grouping `InboundMessage` and `Message` tables by phone number in SQL queries.

**Pros**:
- Avoids creating a new database table.

**Cons**:
- Severe query performance degradation as message tables grow into hundreds of thousands of rows.
- Difficult and slow to maintain unread counts and conversation resolution states (`open`, `resolved`) without storing state somewhere.

### Option 3: Separate DirectMessage table isolated from campaign messages

Create an independent `DirectMessage` table for one on one operator replies while leaving `Message` strictly scoped to campaigns.

**Pros**:
- Leaves the existing `Message` table structure untouched.

**Cons**:
- Duplicates delivery status tracking, webhook listeners, retry mechanisms, and Sentry instrumentation across two parallel message tables.
- Complicates timeline queries, requiring a three way database union across `DirectMessage`, `Message`, and `InboundMessage`.

## Decision

**Chosen option**: Option 1: Dedicated ConversationThread model with optional Message campaignId

We will create an explicit `ConversationThread` model in PostgreSQL holding `lastInboundAt` and `unreadCount`, make `Message.campaignId` optional, add `threadId` to `Message` and `InboundMessage`, update the WhatsApp webhook to atomically upsert threads, implement synchronous oRPC dispatch for direct operator replies, and build a responsive master detail split panel inbox UI at `/inbox`.

**Implementation skills**: `tanstack-start` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-start/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `orpc` (`orpc/skills`, `.agents/skills/orpc/`)

## Rationale

Option 1 provides the highest runtime performance and maintainability. In a production communication system, an operator opening the inbox must see their threads and unread badges instantly. By maintaining `unreadCount`, `lastInboundAt`, `lastMessageSnippet`, and `lastMessageAt` on a dedicated `ConversationThread` record, the sidebar loads with a single indexed query. Storing `lastInboundAt` on the thread directly guarantees that customer care window calculations function reliably even if the incoming sender is not yet saved in the user address book.

Making `Message.campaignId` optional allows direct replies to leverage our proven `Message` status lifecycle (`queued`, `sending`, `sent`, `delivered`, `read`, `failed`), Termii/Meta message IDs, and failure reasons without code duplication.

## Feature design

### Data model sketch

Add `ConversationStatus` enum and `ConversationThread` model, and extend `InboundMessage` and `Message`:

```prisma
enum ConversationStatus {
  open
  resolved
  archived
}

model ConversationThread {
  id                 String             @id @default(uuid())
  userId             String             @map("user_id")
  user               User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  contactId          String?            @map("contact_id")
  contact            Contact?           @relation(fields: [contactId], references: [id], onDelete: SetNull)

  phone              String
  channel            MessageChannel     @default(whatsapp)
  status             ConversationStatus @default(open)

  unreadCount        Int                @default(0) @map("unread_count")
  lastMessageSnippet String?            @map("last_message_snippet")
  lastMessageAt      DateTime           @default(now()) @map("last_message_at")
  lastInboundAt      DateTime?          @map("last_inbound_at")

  createdAt          DateTime           @default(now()) @map("created_at")
  updatedAt          DateTime           @updatedAt @map("updated_at")

  inboundMessages    InboundMessage[]
  outboundMessages   Message[]

  @@unique([userId, phone, channel])
  @@index([userId, status, lastMessageAt(sort: Desc)])
  @@index([phone])
  @@map("conversation_threads")
}
```

Extend existing `InboundMessage`:
```prisma
model InboundMessage {
  // existing fields...
  threadId    String?             @map("thread_id")
  thread      ConversationThread? @relation(fields: [threadId], references: [id], onDelete: SetNull)

  @@index([threadId])
}
```

Extend existing `Message`:
```prisma
model Message {
  id              String                @id @default(uuid())
  campaignId      String?               @map("campaign_id") // now optional
  campaign        Campaign?             @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  threadId        String?               @map("thread_id")
  thread          ConversationThread?   @relation(fields: [threadId], references: [id], onDelete: SetNull)

  contactId       String?               @map("contact_id")
  contactName     String                @map("contact_name")
  phone           String
  channel         MessageChannel
  message         String                @db.Text
  // other existing message fields...

  @@index([threadId])
}
```

### State transitions

1. Thread lifecycle:
   - Created on first inbound message or first direct outreach: `status: open`, `unreadCount: 1`
   - Opened by operator in inbox: `unreadCount` resets to 0
   - Inbound message arrives while open: `unreadCount` increments, `status` reverts to `open` if previously resolved
   - Operator clicks Resolve: `status: resolved`
   - Operator clicks Reopen: `status: open`

2. Customer service window states:
   - Active window: current timestamp is within 24 hours of `thread.lastInboundAt`. Direct freeform text input enabled.
   - Expired window: current timestamp exceeds 24 hours of `thread.lastInboundAt` or `lastInboundAt` is null. Direct freeform input disabled; template picker enabled.

### API surface

| Endpoint / Procedure | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `inbox.listThreads` | RPC / POST | `status?: ConversationStatus`, `channel?: MessageChannel`, `search?: string`, `page: number`, `limit: number` | `items: ThreadSummary[]`, `total: number`, `unreadTotal: number`, `page: number`, `totalPages: number` | Protected session | 400 validation, 401 unauthorized |
| `inbox.getThread` | RPC / POST | `threadId: string`, `limit?: number`, `cursor?: string` | `thread: ThreadDetail`, `timeline: TimelineItem[]`, `window: ServiceWindowStatus`, `nextCursor?: string` | Protected session | 404 not found, 403 forbidden |
| `inbox.sendMessage` | RPC / POST | `threadId: string`, `body?: string`, `templateId?: string`, `templateParams?: Record<string, string>` | `success: boolean`, `messageId: string`, `status: MessageStatus`, `costKobo: number` | Protected session | 400 window expired / validation, 403 forbidden, 402 insufficient funds |
| `inbox.updateThreadStatus` | RPC / POST | `threadId: string`, `status: ConversationStatus` | `success: boolean`, `status: ConversationStatus` | Protected session | 404 not found, 403 forbidden |
| `inbox.enrollContact` | RPC / POST | `threadId: string`, `name: string` | `contact: Contact` | Protected session | 404 not found, 400 invalid name |

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| `listThreads` | Thread list items (contact name, phone, snippet, timestamp, unread badge) | Queried from `prisma.conversationThread.findMany({ where: { userId, ...filters }, include: { contact: true }, orderBy: { lastMessageAt: 'desc' }, skip, take })` |
| `listThreads` | Total unread badge for navigation bar | Summed from `prisma.conversationThread.aggregate({ where: { userId, status: 'open' }, _sum: { unreadCount: true } })` |
| `getThread` | Merged timeline items (up to 50 latest messages) | Merged query: outbound messages from `prisma.message.findMany({ where: { threadId }, take: 50, orderBy: { createdAt: 'desc' } })` and inbound messages from `prisma.inboundMessage.findMany({ where: { threadId }, take: 50, orderBy: { receivedAt: 'desc' } })`, normalized into `{ id, direction, body, status, timestamp }` and returned sorted ascending |
| `getThread` | Customer service window status and remaining seconds | Calculated from `thread.lastInboundAt`: `isOpen = now - lastInboundAt < 24 * 3600 * 1000`, `remainingSeconds = Math.max(0, Math.floor((lastInboundAt + 24h - now) / 1000))` |
| `getThread` | Unread reset side effect | Executed on fetch: `prisma.conversationThread.update({ where: { id: threadId }, data: { unreadCount: 0 } })` |
| `sendMessage` | Meta message dispatch ID (wamid) | Returned synchronously from Meta Graph API `POST /v22.0/{phone_number_id}/messages` |
| `sendMessage` | Wallet debit amount | Sourced from template fee calculator `calculateWhatsAppCostKobo(category)` if sending outside window; 0 kobo if sending freeform reply within active 24 hour customer care window |
| `enrollContact` | Contact association | Creates `Contact` record via `prisma.contact.create` and links `thread.contactId = contact.id` |
| Webhook inbound | Thread linkage and unread increment | Atomic upsert in `src/routes/api/webhooks/whatsapp.ts`: `prisma.conversationThread.upsert({ where: { userId_phone_channel }, update: { unreadCount: { increment: 1 }, lastMessageSnippet, lastMessageAt, lastInboundAt, status: 'open' }, create: { ... } })` |

### Key invariants

1. Authoritative window validation: An operator cannot send a freeform message if `thread.lastInboundAt` is older than 24 hours at the exact moment the server procedure executes, even if the client interface held an open timer.
2. Tenant scoping: Every procedure strictly verifies `thread.userId === ctx.user.id`. Operators cannot read, write, or update threads of other accounts.
3. Thread uniqueness: Exactly one `ConversationThread` exists per `(userId, phone, channel)`. Concurrent webhooks must safely upsert without creating duplicate threads.
4. Outbound reply marking: Successfully dispatching an outbound operator reply marks prior pending `InboundMessage.replied` flags to true.
5. Rate limiting: Direct operator message dispatch is capped at 30 messages per minute per user to prevent rapid double clicks or client loops.

### Security model

- All inbox procedures require an authenticated Better Auth session via `authMiddleware`.
- Session user ID is verified against the `thread.userId` on all reads and mutations.
- Operator direct message dispatching is instrumented via Sentry `startSpan` with tags for `threadId`, `channel`, and `userId`.
- External Meta API tokens and webhook secrets remain isolated in environment variables.

### Configuration required

- No new environment variables required. Reuses existing `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_WEBHOOK_SECRET`.

### Critical test scenarios

- Happy path freeform reply: Inbound message opens 24 hour window, operator types freeform text in inbox, message dispatches via Meta API, appears in timeline with sent status, and resets unread count, verifying **AC-1**, **AC-2**, **AC-3**, and **AC-4**.
- Expired window rejection: Attempting to send freeform text when `lastInboundAt` is 25 hours old is rejected with 400 Bad Request, requiring template selection, verifying **AC-3** and **AC-5**.
- Template dispatch outside window: Selecting and sending an approved template to an expired thread debits kobo from wallet and dispatches successfully, verifying **AC-5**.
- Inbound webhook upsert: Receiving an inbound WhatsApp webhook creates or updates the ConversationThread atomically and increments unread count without throwing unique constraint collisions, verifying **AC-1** and **AC-6**.
- Status toggle: Resolving an open thread moves it to the resolved tab; receiving a new inbound reply automatically re opens the thread, verifying **AC-7**.
- Unknown number handling: Receiving a message from a number not in contacts displays formatted phone number and Add to Contacts button, which successfully creates a contact record, verifying **AC-8**.
- Cross tenant access guard: Attempting to view or send messages in another user's thread returns 404 or 403, verifying **AC-2** and **AC-4**.

## Build plan

Following our Tracer Bullet delivery approach, we will implement this feature as a thin end to end thread through every layer first, then thicken UI capabilities:

1. Create database migration for `ConversationStatus` enum, `ConversationThread` model, nullable `Message.campaignId`, and foreign key relations on `Message` and `InboundMessage`, satisfies **AC-1**, **AC-2**.
2. Update WhatsApp webhook in `src/routes/api/webhooks/whatsapp.ts` to atomically upsert `ConversationThread`, record `lastInboundAt`, increment unread counters, and link inbound messages, satisfies **AC-1**, **AC-3**, **AC-6**.
3. Implement `inbox.listThreads`, `inbox.getThread`, `inbox.updateThreadStatus`, and `inbox.enrollContact` oRPC procedures with normalized chronological timeline union, 24 hour window computation, and auto unread reset, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-7**, **AC-8**.
4. Implement `inbox.sendMessage` oRPC procedure with authoritative 24 hour window validation, synchronous Meta direct text dispatch, template fallback, and wallet deduction, satisfies **AC-3**, **AC-4**, **AC-5**.
5. Build the responsive master detail split panel inbox UI at `src/routes/(dashboard)/inbox/index.tsx` with sidebar thread list, search filtering, message timeline bubbles, live window countdown, freeform composer, template picker dialog, and quick contact enrollment, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**.

## Consequences

**Positive**:
- Two way customer engagement: Velocast transforms from a one way broadcast tool into an interactive customer support and follow up console.
- Meta compliance: Authoritative 24 hour window tracking protects the business WhatsApp account from policy violations and template fees.
- Clean thread navigation: High performance sidebar and unread indicators keep operators organized across multiple outreach campaigns.
- Future proof channel model: Generic channel parameters allow SMS two way communication to be connected as soon as Termii supports inbound responses.

**Negative / tradeoffs**:
- Making `Message.campaignId` nullable requires caution in existing campaign queries to handle potential null campaign IDs for direct messages.
- Polling adds lightweight periodic query traffic to PostgreSQL while operators have the inbox open.

**Neutral**:
- Navigation bar gains an active unread badge indicator.

## Follow-up

- [ ] Add navigation bar icon and unread counter badge linking to `/inbox` in the main dashboard sidebar.
- [ ] Investigate Termii inbound SMS webhook support periodically for potential SMS two way conversational activation.
