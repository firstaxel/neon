# 0008. WhatsApp Outreach and Template Manager

**Date**: 2026-09-13
**Status**: Accepted

## Summary

This specification defines the WhatsApp outreach and template management system for Velocast. Organizations can synchronize approved WhatsApp Business message templates from Meta Cloud API, compose and submit new templates for review, and map template variables to dynamic contact fields in the campaign wizard. Outbound campaigns enforce pre approved templates for marketing broadcasts, reserve wallet funds at ninety naira per recipient via two phase holds, dispatch messages through throttled Inngest workers, and track delivery status callbacks in real time.

## Context

WhatsApp is the most popular messaging medium in Nigeria, offering high engagement and read rates compared to traditional channels. However, Meta strictly regulates outbound commercial messaging to prevent spam and preserve user experience.

Under Meta WhatsApp Cloud API rules, businesses cannot initiate proactive outreach to customers using freeform text messages. Freeform messaging is strictly restricted to customer service windows (twenty four hours after a customer sends an inbound message). Any proactive broadcast, including marketing campaigns, announcements, and payment reminders, must use an approved WhatsApp message template registered with Meta. Furthermore, Meta charges per conversation category in local currency equivalents, with marketing conversations in Nigeria priced at ninety naira (nine thousand kobo) per delivered message.

Operating WhatsApp broadcasts requires tight integration across multiple layers. First, templates composed in Velocast must submit to Meta with specified categories, languages, and component structures, while tracking approval status changes asynchronously through webhooks. Second, campaign wizards must map positional parameters (`{{1}}`, `{{2}}`) to recipient names and custom details with live previews. Third, because WhatsApp marketing costs fifteen times more than SMS, wallet balances must be securely verified and reserved upfront through two phase holds, reconciling debits only when Meta confirms delivery. Finally, delivery callbacks (`sent`, `delivered`, `read`, `failed`) must update message logs to give operators clear visibility into broadcast performance.

## Requirements

**User stories**:
- As a campaign manager, I want to view my synchronized WhatsApp message templates with their Meta approval status so that I know which messages are approved for sending.
- As a campaign manager, I want to compose new WhatsApp templates with headers, body text, and call to action buttons and submit them to Meta directly from the dashboard.
- As a campaign manager, I want to select an approved WhatsApp template in the campaign wizard and map template parameters to contact names and organization details with live preview.
- As an organization owner, I want my wallet balance safely held at nine thousand kobo per recipient upfront so that broadcasts do not overdraft my account, with unspent funds refunded if numbers fail.
- As a campaign manager, I want real time delivery status indicators (sent, delivered, read, failed) for each WhatsApp message so that I can monitor audience engagement.

**Acceptance criteria**:
- **AC-1**: Users can view all WhatsApp message templates with clear approval status badges (`APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`), rejection reason explanations, and category indicators (`MARKETING`, `UTILITY`, `AUTHENTICATION`).
- **AC-2**: Users can compose new WhatsApp templates with optional media or text headers, body text containing positional variables (`{{1}}`, `{{2}}`), footer text, and interactive buttons, submitting them to Meta Cloud API for review.
- **AC-3**: Inbound Meta webhooks update template status automatically in real time when Meta approves, rejects, or pauses a template, updating local database records without requiring manual synchronization.
- **AC-4**: The campaign creation wizard filters available templates, permitting users to select only templates whose Meta status is `APPROVED`.
- **AC-5**: The campaign creation wizard parses positional variables (`{{1}}`, `{{2}}`) from the selected template and provides input mapping fields for contact attributes (name, phone) or campaign custom values, showing a live interactive preview before launch.
- **AC-6**: Cost estimation calculates total broadcast expense at nine thousand kobo (90 NGN) per recipient, asserting that spendable wallet balance covers the total, and blocking submission with an inline top up prompt if funds are insufficient.
- **AC-7**: Launching a WhatsApp campaign places an atomic two phase wallet hold (`campaign_hold`) for the total estimated kobo amount, creates the campaign row in `pending` status, and triggers Inngest dispatch.
- **AC-8**: Inngest orchestrator and workers dispatch messages using Meta Cloud API `sendTemplateMessage`, passing the registered template name, language code, and resolved parameter array, saving Meta's message reference (`wamid`) on the message record.
- **AC-9**: Meta delivery status webhooks (`sent`, `delivered`, `read`, `failed`) match messages by `wamid` and update `Message.status`, `deliveredAt`, and `readAt` timestamps.
- **AC-10**: Campaign completion reconciles the two phase wallet hold, charging only for successful deliveries and releasing unspent holds for failed or invalid numbers back to spendable wallet balance.

## Options considered

### Option 1: Official Meta Cloud API Pre Approved Templates with Webhook Delivery Tracking (Chosen)

Manage templates and broadcasts directly through Meta WhatsApp Business Cloud API. Outbound broadcasts enforce approved templates with positional parameter mapping. Inngest workers dispatch messages using `sendTemplateMessage`. Webhooks ingest asynchronous status events (`sent`, `delivered`, `read`, `failed`) and trigger wallet hold reconciliation.

**Pros**:
- Full compliance with Meta policies, avoiding number bans or account suspensions.
- High deliverability through official Meta Cloud infrastructure.
- Detailed message tracking with read receipts and delivery timestamps.
- Standardized pricing and automated webhook reconciliation protect organization finances.

**Cons**:
- Requires pre approval of message templates by Meta before broadcasts can launch.
- Higher cost per message compared to SMS (90 NGN vs 6 NGN).

### Option 2: Unofficial WhatsApp Web or Browser Automation Gateways

Connect a phone via QR code scanning and send freeform messages using headless browser automation or reverse engineered protocols.

**Pros**:
- Allows sending freeform text without prior template approval.
- Avoids per message Meta conversation fees.

**Cons**:
- High risk of permanent phone number bans by Meta anti spam filters.
- Unstable session connections that disconnect frequently.
- Unsuitable for scalable commercial broadcasts or high priority outreach.

### Option 3: Direct Freeform Text Messaging via Meta Cloud API

Use Meta Cloud API but send freeform text messages directly to recipient numbers without selecting a template.

**Pros**:
- Simpler wizard without template selection or parameter mapping.

**Cons**:
- Fails completely for outbound broadcasts because Meta rejects freeform messages sent outside the customer initiated twenty four hour window.

## Decision

**Chosen option**: Option 1: Official Meta Cloud API Pre Approved Templates with Webhook Delivery Tracking

We implement official Meta WhatsApp Cloud API integration, enforcing approved message templates for outbound broadcasts, supporting positional parameter mapping, and tracking deliveries and financial reconciliation via webhooks.

**Implementation skills**: `tanstack-start` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-start/`) · `tanstack-form` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-form/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `inngest-durable-functions` (`inngest/inngest-skills`, `.agents/skills/inngest-durable-functions/`) · `orpc` (`orpc/skills`, `.agents/skills/orpc/`)

## Rationale

WhatsApp communication is personal and prominent on Nigerian smartphones. Sending unsolicited, spammy messages through unofficial workarounds leads to immediate phone number bans and reputational damage. Option 1 adheres to official Meta guidelines, ensuring ninety nine percent delivery reliability and long term account stability.

Enforcing approved message templates also protects operators from costly delivery errors. By calculating wallet holds upfront based on Meta conversation pricing (nine thousand kobo) and mapping variables with live preview, users know the exact cost and appearance of their outreach before launching. Integrating Inngest queues ensures requests do not overwhelm Meta Cloud API rate limits.

## Feature design

**Data model sketch**:

```prisma
model MessageTemplate {
  id              String            @id @default(uuid())
  userId          String            @map("user_id")
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  name            String            // snake_case, unique per WhatsApp Business Account
  displayName     String            @map("display_name")
  language        String            @default("en")
  category        String            @default("MARKETING") // MARKETING, UTILITY, AUTHENTICATION
  status          String            @default("DRAFT")     // DRAFT, PENDING, APPROVED, REJECTED, PAUSED

  waTemplateId    String?           @map("wa_template_id")
  waAccountId     String?           @map("wa_account_id")
  rejectionReason String?           @map("rejection_reason")

  headerFormat    String?           @map("header_format") // TEXT, IMAGE, VIDEO, DOCUMENT
  headerText      String?           @map("header_text")
  headerVars      String[]          @default([]) @map("header_vars")

  bodyText        String            @map("body_text") @db.Text
  bodyVars        String[]          @default([]) @map("body_vars") // ["name", "event", "date"]
  footerText      String?           @map("footer_text")
  buttons         Json?

  smsBody         String            @map("sms_body") @db.Text
  smsVars         String[]          @default([]) @map("sms_vars")

  usageCount      Int               @default(0) @map("usage_count")
  channel         MessageChannel    @default(whatsapp)

  submittedAt     DateTime?         @map("submitted_at")
  approvedAt      DateTime?         @map("approved_at")
  lastUsedAt      DateTime?         @map("last_used_at")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  campaigns       Campaign[]

  @@unique([userId, name])
  @@index([userId, status])
  @@map("message_templates")
}

model Campaign {
  id                String            @id @default(uuid())
  userId            String            @map("user_id")
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  name              String?
  scenario          Scenario
  status            JobStatus         @default(pending)
  deliveryMode      DeliveryMode      @default(marketing) @map("delivery_mode")

  templateId        String?           @map("template_id")
  template          MessageTemplate?  @relation(fields: [templateId], references: [id], onDelete: SetNull)
  waTemplateName    String?           @map("wa_template_name")
  waTemplateLanguage String?          @map("wa_template_language")
  templateParams    Json?             @map("template_params") // Ordered variable mappings

  whatsappTemplate  String            @map("whatsapp_template") @db.Text
  smsTemplate       String            @map("sms_template") @db.Text
  useCustomTemplate Boolean           @default(false) @map("use_custom_template")

  totalMessages     Int               @default(0) @map("total_messages")
  sentMessages      Int               @default(0) @map("sent_messages")
  failedMessages    Int               @default(0) @map("failed_messages")
  estimatedCostKobo Int               @default(0) @map("estimated_cost_kobo")

  scheduledAt       DateTime?         @map("scheduled_at")
  startedAt         DateTime?         @map("started_at")
  completedAt       DateTime?         @map("completed_at")
  createdAt         DateTime          @default(now()) @map("created_at")

  messages          Message[]
  transactions      Transaction[]

  @@index([userId])
  @@index([status])
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

  costKobo        Int?           @map("cost_kobo")
  status          MessageStatus  @default(queued)

  metaMessageId   String?        @unique @map("meta_message_id")
  termiiMessageId String?        @unique @map("termii_message_id")

  sentAt          DateTime?      @map("sent_at")
  deliveredAt     DateTime?      @map("delivered_at")
  readAt          DateTime?      @map("read_at")
  errorMessage    String?        @map("error_message")
  createdAt       DateTime       @default(now()) @map("created_at")

  @@index([campaignId])
  @@index([campaignId, status])
  @@index([metaMessageId])
  @@map("messages")
}
```

**State transitions**:
- Template lifecycle: `DRAFT` &rarr; `PENDING` (submitted to Meta) &rarr; `APPROVED` (ready for broadcast) OR `REJECTED` (requires edits).
- Campaign lifecycle: `pending` (hold placed and queued) &rarr; `dispatching` (worker running) &rarr; `completed` (all recipients processed and reconciled) OR `failed`.
- Message lifecycle: `queued` &rarr; `sending` &rarr; `sent` (accepted by Meta) &rarr; `delivered` (device received) &rarr; `read` (user opened) OR `failed` (delivery failure).

**API surface**:

| Procedure | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `template.list` | GET | `status?: string`, `channel?: string` | `templates: array` | protected | 401 unauthorized |
| `template.get` | GET | `templateId: string` | `template: object` | protected | 401 unauthorized, 404 not found |
| `template.create` | POST | `name: string`, `displayName: string`, `category: string`, `bodyText: string`, `bodyVars: string[]`, `buttons?: array` | `templateId: string`, `status: string` | protected | 400 invalid schema or duplicate name, 401 unauthorized |
| `template.submit` | POST | `templateId: string` | `templateId: string`, `waTemplateId: string`, `status: string` | protected | 400 not in draft, 401 unauthorized, 502 Meta API error |
| `template.syncStatus` | POST | `templateId: string` | `templateId: string`, `status: string`, `rejectionReason?: string` | protected | 401 unauthorized, 404 not found |
| `campaign.estimateWhatsappCost` | POST | `templateId: string`, `contactIds?: string[]`, `audienceFilter?: object`, `templateParams?: object` | `totalContacts: number`, `unitCostKobo: number`, `totalEstimatedCostKobo: number`, `availableBalanceKobo: number`, `sufficientBalance: boolean` | protected | 400 template not approved, 401 unauthorized |
| `campaign.createWhatsappCampaign` | POST | `name?: string`, `templateId: string`, `contactIds?: string[]`, `audienceFilter?: object`, `templateParams: object`, `scheduledAt?: string` | `campaignId: string`, `status: string`, `totalMessages: number`, `heldKobo: number` | protected | 400 insufficient funds or invalid mapping, 401 unauthorized |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| `estimateWhatsappCost` | `unitCostKobo` | Fixed pricing constant `PRICING.PER_MESSAGE.whatsapp` (9000 kobo) |
| `estimateWhatsappCost` | `totalEstimatedCostKobo` | Derived as `totalContacts * 9000 kobo` |
| `createWhatsappCampaign` | `waTemplateName` | Looked up from `MessageTemplate.name` via `templateId` |
| `createWhatsappCampaign` | `heldKobo` | Total estimated cost reserved via `holdCampaignFunds` |
| `sendWorker` | `parameters` array | Formatted from `templateParams` mapped to contact name and custom fields |
| `sendWorker` | `metaMessageId` | Extracted from Meta Cloud API response `messages[0].id` (`wamid`) |
| `webhookPost` | `messageStatus` | Extracted from Meta inbound status event (`sent`, `delivered`, `read`, `failed`) |

**Key invariants**:
- Template approval enforcement: only templates with status `APPROVED` can be selected in `createWhatsappCampaign`.
- Outbound broadcast policy: all WhatsApp campaigns must dispatch through `sendTemplateMessage`; freeform text is rejected for outbound broadcasts.
- Spendable balance invariant: `wallet.balanceKobo - wallet.heldKobo >= estimatedCostKobo` must hold before any campaign can be created.
- Complete variable resolution: every positional placeholder in the template must map to a contact attribute or user provided campaign default before launch.
- Webhook signature integrity: all inbound Meta webhook requests verify `X-Hub-Signature-256` matching HMAC SHA256 of payload against `META_APP_SECRET`.

**Security model**:
- Protected procedures: all template and campaign procedures require an active session verified via `protectedProcedure`.
- Meta credentials: `META_ACCESS_TOKEN` and `META_PHONE_NUMBER_ID` remain strictly server side.
- Webhook verification: GET requests verify `hub.verify_token`, and POST requests verify HMAC signature.
- Multi tenant isolation: users cannot view or send campaigns using another organization template or contact.

**Configuration required**:
- `META_WABA_ID`: WhatsApp Business Account ID in Meta Business Manager.
- `META_PHONE_NUMBER_ID`: Registered WhatsApp phone number ID.
- `META_ACCESS_TOKEN`: Permanent System User access token with `whatsapp_business_messaging` permissions.
- `META_API_VERSION`: Graph API version string (`v22.0`).
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Shared secret token for webhook verification challenge.
- `META_APP_SECRET`: App secret used for validating webhook HMAC signatures.

**Critical test scenarios**:
- Happy path: Operator creates template, submits to Meta, webhook receives `APPROVED`, operator selects template in campaign wizard, maps `{{1}}` to contact name, wallet holds 9000 kobo per contact, Inngest dispatches via `sendTemplateMessage`, and delivery webhooks record `delivered`, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**.
- Insufficient wallet balance: Operator selects 100 contacts (900,000 kobo) with only 500,000 kobo spendable balance; procedure throws insufficient funds error and blocks submission, verifies **AC-6**.
- Unapproved template blocking: Operator attempts to launch campaign with a template in `PENDING` or `REJECTED` status; endpoint returns 400 validation error, verifies **AC-4**.
- Variable mapping completeness: Template contains `{{1}}` and `{{2}}`, but operator provides mapping only for `{{1}}`; wizard blocks launch until `{{2}}` has a value, verifies **AC-5**.
- Delivery failure refund: Out of 50 contacts, 2 numbers are not registered on WhatsApp; Meta returns failure code; worker records failures and orchestrator refunds 18,000 kobo unspent hold, verifies **AC-10**.

## Build plan

Following our project Tracer Bullet approach, we construct a thin end to end thread connecting template retrieval, wizard variable mapping, wallet hold reservation, Meta Cloud API template dispatch, and delivery webhook reconciliation.

1. Update database schema with migration adding `templateId`, `waTemplateName`, `waTemplateLanguage`, and `templateParams` to `Campaign`, and `metaMessageId`, `readAt` to `Message`, satisfies **AC-4**, **AC-7**, **AC-8**, **AC-9**
2. Refactor Meta messaging client in `src/lib/meta-send.ts` to ensure template dispatch strictly uses `sendTemplateMessage` with positional parameter mapping, satisfies **AC-8**
3. Create oRPC procedure `campaign.estimateWhatsappCost` and update `campaign.createWhatsappCampaign` with template validation and atomic wallet hold reservation, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**
4. Update Inngest campaign worker in `src/features/jobs/functions/send-campaign.ts` to dispatch WhatsApp messages via `sendTemplateMessage` and record returned `wamid` identifiers, satisfies **AC-7**, **AC-8**
5. Enhance Meta webhook handler in `src/routes/api/webhooks/whatsapp.ts` to update template statuses and message delivery statuses with unspent hold reconciliation on terminal failure, satisfies **AC-3**, **AC-9**, **AC-10**
6. Build template selection step and positional variable mapping interface in `src/features/campaigns/components/campaign-wizard.tsx` with live preview, satisfies **AC-4**, **AC-5**
7. Build template management list and submission view in `src/features/templates/view/whatsapp-list-view.tsx` showing approval badges and rejection notices, satisfies **AC-1**, **AC-2**
8. Write comprehensive automated unit and integration tests covering template validation, variable resolution, wallet hold calculations, Inngest dispatch, and delivery webhook processing, satisfies **AC-1**, **AC-4**, **AC-5**, **AC-6**, **AC-8**, **AC-9**, **AC-10**

## Consequences

**Positive**:
- Guarantees high WhatsApp broadcast deliverability by strictly adhering to official Meta Cloud API rules.
- Upfront wallet holds at ninety naira per recipient prevent negative account balances.
- Parameter mapping with live preview eliminates formatting errors before spending money.
- Real time delivery and read tracking provides transparent campaign analytics.

**Negative / tradeoffs**:
- Outbound broadcasts are restricted to pre approved templates, requiring prior Meta submission.
- Marketing conversations incur higher per message costs compared to standard SMS.

**Neutral**:
- Requires valid Meta Business Manager, verified WhatsApp Business Account, and registered phone number ID.

## Follow-up

- [ ] Add support for WhatsApp media headers (images and PDF flyers) in the campaign wizard in a future slice.
- [ ] Connect delivery analytics to the reporting dashboard in Feature 10.

