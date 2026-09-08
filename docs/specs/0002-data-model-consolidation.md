# 0002. Data Model Consolidation

**Date**: 2026-09-07
**Status**: Accepted

## Summary

This specification defines the consolidation of the PostgreSQL database schema using Prisma ORM. We prune deprecated subscription models and unused SMS provider columns, fix one to one relationship declarations, make contact image parsing optional, and add composite database indexes. These changes establish an efficient, clean foundation for prepaid Paystack kobo wallet billing, audience contact management, and multi channel campaigns.

## Context

Velocast is a multi channel broadcast and messaging platform built on PostgreSQL, Prisma ORM, and Bun. The initial database schema accumulated several inconsistencies during rapid prototyping:

1. The `Message` model contained a legacy `twilioSid` column and an invalid `users User[]` relation, even though the platform dispatches SMS via Termii and WhatsApp via Meta Cloud API.
2. The `Contact` model strictly required `parseJobId`, forcing manual contact entry and CSV imports to fabricate synthetic `ParseJob` records.
3. The `User` model declared plural arrays for `wallets Wallet[]` and `userProfiles UserProfile[]`, despite both relations being strictly one to one with unique user identifiers.
4. The schema included a `Subscription` model and plan enums that conflict with the product truth of prepaid Paystack kobo wallet billing.
5. Critical query paths across campaigns, transactions, and audience contacts lacked composite database indexes.

Leaving these defects in place increases database overhead, creates confusion in generated TypeScript types, and complicates upcoming features such as CSV contact imports, Paystack deposit flows, and Termii delivery tracking. Consolidating the schema now provides clean data boundaries and predictable migrations before implementing further product slices.

## Requirements

**User stories**:
- As a developer, I want a clean and consolidated Prisma schema so that our application code interacts with accurate types and well structured database tables.
- As an organization owner, I want my contacts, campaigns, and financial transactions cleanly indexed and isolated so that dispatches and ledger calculations execute quickly without duplicate data.

**Acceptance criteria**:
- **AC-1**: The Prisma schema defines clean, validated models for Better Auth authentication, prepaid billing, audience contacts, campaign messaging, two way inbox replies, sender identities, organization profiles, and workspace memberships.
- **AC-2**: The `Message` model removes the deprecated `twilioSid` column and the invalid `users User[]` relation, adding `termiiMessageId` for SMS delivery tracking alongside `metaMessageId` for WhatsApp.
- **AC-3**: The `Contact` model makes `parseJobId` optional with `onDelete: SetNull`, allowing manual contact entries and CSV imports to persist without synthetic `ParseJob` records.
- **AC-4**: Phone numbers are sanitized to E.164 format via shared Zod validation in router input schemas, and phone uniqueness is enforced per user on the `Contact` model via `@@unique([uploadedBy, phone])`.
- **AC-5**: `User` relations to `Wallet` and `UserProfile` are defined as strict one to one relations (`wallet Wallet?`, `userProfile UserProfile?`).
- **AC-6**: The `Subscription` table and its associated enums (`SubscriptionPlan`, `SubscriptionStatus`) are removed, concentrating all billing logic on the prepaid `Wallet` and immutable `Transaction` ledger.
- **AC-7**: A native PostgreSQL text array `tags String[] @default([])` is added to `Contact` to support fast audience filtering without join table overhead.
- **AC-8**: Composite indexes exist across all active query paths, including `[walletId, createdAt(sort: Desc)]` on transactions, `[campaignId, status]` and `[campaignId, channel]` on messages, `[userId, channel]` on sender numbers and templates, `[phone]` on contacts, and `[userId, replied]` on inbound messages.
- **AC-9**: The consolidated schema validates with `prisma validate`, generates TypeScript types with `prisma generate`, and applies cleanly to PostgreSQL via an incremental migration containing automated data sanitization scripts.

## Options considered

### Option 1: Fix in place with clean incremental migration (Chosen)

Refactor `prisma/schema.prisma` directly to remove dead columns, align relations to singular, add missing indexes, and generate a standard Prisma migration script that safely alters the existing tables.

**Pros**:
- Preserves existing development and test records without requiring a full database reset.
- Generates a versioned migration file that runs reliably in development, staging, and production environments.
- Directly resolves schema defects and updates generated types across the codebase.

**Cons**:
- Migration SQL must run automated deduplication before creating unique constraints to prevent deployment crashes.

### Option 2: Reset the database and recreate baseline schema

Wipe existing migrations and generate a single fresh baseline migration from scratch against an empty database.

**Pros**:
- Produces a single migration file without intermediate historical migration baggage.

**Cons**:
- Destructive to existing local database state and requires re seeding all user and profile records.
- Breaks continuous migration history for any existing deployment.

### Option 3: Retain subscriptions and legacy provider fields as deprecated

Keep `Subscription`, `twilioSid`, and required parse jobs in the schema, marking them as deprecated in code comments.

**Pros**:
- Zero risk of breaking any uncommitted branch or legacy router query.

**Cons**:
- Preserves technical debt, forces developers to continue creating synthetic parse jobs, and clutters the data model with unused tables.

## Decision

**Chosen option**: Option 1: Fix in place with clean incremental migration

We refactor `prisma/schema.prisma` in place and produce an incremental migration that prunes dead columns, fixes relation cardinality, adds contact tags and Termii tracking, establishes composite indexes, and embeds automated SQL safety checks.

**Implementation skills**: `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Rationale

Option 1 provides a clean, safe path forward. Because Velocast is actively being developed with real database connections, resetting the database (Option 2) introduces unnecessary disruption and discards migration continuity. Leaving unused models and broken relations in place (Option 3) would directly contradict the project mission of building a dependable foundation before proceeding to Slice 1.

By generating a targeted incremental migration, we safely update existing tables, make `parseJobId` optional, add `termiiMessageId`, remove `twilioSid`, and drop the `Subscription` table while preserving the integrity of user and wallet records. Incorporating automated deduplication and database check constraints in the migration SQL guarantees that local and remote deployments execute without failure.

## Feature design

**Data model sketch**:

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

// ─── Authentication (Better Auth) ─────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  createdAt     DateTime  @default(now()) @db.Timestamp
  updatedAt     DateTime  @updatedAt @db.Timestamp
  email         String    @unique
  name          String?
  emailVerified Boolean   @default(false)
  image         String?

  // One to one relations
  wallet        Wallet?
  userProfile   UserProfile?

  // One to many relations
  sessions         Session[]
  accounts         Account[]
  contacts         Contact[]
  campaigns        Campaign[]
  parseJobs        ParseJob[]
  messageTemplates MessageTemplate[]
  senderNumbers    SenderNumber[]
  inboundMessages  InboundMessage[]

  // Team workspace relations
  orgInvitesSent     OrgInvite[]       @relation("OrgInvitesSent")
  orgMembersOwned    OrgMember[]       @relation("OrgMembersOwned")
  orgMemberships     OrgMember[]       @relation("OrgMemberships")
  joinRequestsOwned  OrgJoinRequest[]  @relation("OrgJoinRequestsOwned")
  joinRequestsSent   OrgJoinRequest[]  @relation("OrgJoinRequestsSent")

  @@map("user")
}

model Session {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @db.Timestamp
  updatedAt DateTime @updatedAt @db.Timestamp
  userId    String
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}

// ─── Profile and Settings ─────────────────────────────────────────────────────

enum UserRole {
  admin
  leader
  manager
  staff
  volunteer
  coordinator
}

model UserProfile {
  id                 String    @id @default(uuid())
  userId             String    @unique @map("user_id")
  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  orgType            String?   @map("org_type")
  orgName            String?   @map("org_name")
  orgSize            String?   @map("org_size")
  role               UserRole  @default(staff)
  phone              String?

  senderId           String?   @map("sender_id")
  usePlatformSender  Boolean   @default(true) @map("use_platform_sender")

  onboardingComplete Boolean   @default(false) @map("onboarding_complete")
  onboardingStep     Int       @default(0)     @map("onboarding_step")
  timezone           String    @default("Africa/Lagos")

  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt      @map("updated_at")

  @@map("user_profiles")
}

// ─── Prepaid Billing ──────────────────────────────────────────────────────────

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
  id            String   @id @default(uuid())
  userId        String   @unique @map("user_id")
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  balanceKobo   Int      @default(0) @map("balance_kobo")
  heldKobo      Int      @default(0) @map("held_kobo")

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

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
  paystackRef      String?           @map("paystack_ref")

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

// ─── Contacts and AI Extraction ───────────────────────────────────────────────

enum MessageChannel {
  whatsapp
  sms
}

enum ContactType {
  new_contact
  returning
  contact
  prospect
}

enum ParseJobStatus {
  pending
  parsing
  done
  error
}

model ParseJob {
  id               String         @id @default(uuid())
  status           ParseJobStatus @default(pending)

  r2Key            String         @map("r2_key")
  r2Bucket         String         @map("r2_bucket")
  originalFilename String?        @map("original_filename")
  mimeType         String         @map("mime_type")
  fileSizeBytes    Int?           @map("file_size_bytes")

  rawExtractedText String?        @map("raw_extracted_text") @db.Text
  confidence       Float?
  warnings         String[]       @default([])
  errorMessage     String?        @map("error_message")

  inngestEventId   String?        @map("inngest_event_id")

  createdAt        DateTime       @default(now()) @map("created_at")
  startedAt        DateTime?      @map("started_at")
  completedAt      DateTime?      @map("completed_at")

  parsedBy         String         @map("parsed_by")
  user             User           @relation(fields: [parsedBy], references: [id], onDelete: Cascade)

  contacts         Contact[]

  @@index([status])
  @@index([parsedBy])
  @@index([createdAt(sort: Desc)])
  @@map("parse_jobs")
}

model Contact {
  id            String         @id @default(uuid())
  uploadedBy    String         @map("uploaded_by")
  user          User           @relation(fields: [uploadedBy], references: [id], onDelete: Cascade)

  parseJobId    String?        @map("parse_job_id")
  parseJob      ParseJob?      @relation(fields: [parseJobId], references: [id], onDelete: SetNull)

  name          String
  phone         String
  channel       MessageChannel
  type          ContactType    @default(prospect)
  tags          String[]       @default([])
  email         String?
  notes         String?
  rawRow        String?        @map("raw_row")

  optedOut      Boolean        @default(false) @map("opted_out")
  optedOutAt    DateTime?      @map("opted_out_at")
  lastInboundAt DateTime?      @map("last_inbound_at")

  createdAt     DateTime       @default(now()) @map("created_at")

  @@unique([uploadedBy, phone])
  @@index([parseJobId])
  @@index([uploadedBy])
  @@index([channel])
  @@index([type])
  @@index([phone])
  @@map("contacts")
}

// ─── Campaigns and Messaging ──────────────────────────────────────────────────

enum JobStatus {
  pending
  processing
  completed
  failed
}

enum DeliveryMode {
  marketing
  utility_prescreen
  sms_fallback
}

enum MessageStatus {
  pending
  queued
  sending
  sent
  delivered
  read
  failed
  rate_limited
  opted_out
}

enum Scenario {
  first_timer
  follow_up
  event_invite
  request
  general
}

model Campaign {
  id                String            @id @default(uuid())
  userId            String            @map("user_id")
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)

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

  inngestEventId    String?           @map("inngest_event_id")

  createdAt         DateTime          @default(now()) @map("created_at")
  startedAt         DateTime?         @map("started_at")
  completedAt       DateTime?         @map("completed_at")

  messages          Message[]
  pendingDeliveries PendingDelivery[]
  inboundMessages   InboundMessage[]

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

  status          MessageStatus  @default(queued)
  fromNumber      String?        @map("from_number")
  termiiMessageId String?        @unique @map("termii_message_id")
  metaMessageId   String?        @unique @map("meta_message_id")

  errorMessage    String?        @map("error_message")
  retryCount      Int            @default(0) @map("retry_count")

  sentAt          DateTime?      @map("sent_at")
  deliveredAt     DateTime?      @map("delivered_at")
  createdAt       DateTime       @default(now()) @map("created_at")

  @@index([campaignId])
  @@index([campaignId, status])
  @@index([campaignId, channel])
  @@index([status])
  @@index([channel])
  @@index([termiiMessageId])
  @@index([metaMessageId])
  @@map("messages")
}

model PendingDelivery {
  id             String    @id @default(uuid())
  campaignId     String    @map("campaign_id")
  campaign       Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  contactId      String?   @map("contact_id")
  contactName    String    @map("contact_name")
  phone          String
  realMessage    String    @db.Text
  prescreenMsgId String?   @map("prescreen_msg_id")

  replied        Boolean   @default(false)
  repliedAt      DateTime? @map("replied_at")
  expiresAt      DateTime  @map("expires_at")

  createdAt      DateTime  @default(now()) @map("created_at")

  @@index([phone])
  @@index([campaignId])
  @@index([expiresAt])
  @@map("pending_deliveries")
}

model InboundMessage {
  id          String         @id @default(uuid())
  userId      String         @map("user_id")
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  phone       String
  contactName String?        @map("contact_name")
  contactId   String?        @map("contact_id")
  channel     MessageChannel
  body        String         @db.Text

  campaignId  String?        @map("campaign_id")
  campaign    Campaign?      @relation(fields: [campaignId], references: [id], onDelete: SetNull)

  externalId  String?        @unique @map("external_id")
  receivedAt  DateTime       @default(now()) @map("received_at")
  replied     Boolean        @default(false)
  repliedAt   DateTime?      @map("replied_at")
  isKeyword   Boolean        @default(false) @map("is_keyword")

  createdAt   DateTime       @default(now()) @map("created_at")

  @@index([userId, receivedAt(sort: Desc)])
  @@index([phone])
  @@index([userId, replied])
  @@index([externalId])
  @@map("inbound_messages")
}

// ─── Templates and Senders ────────────────────────────────────────────────────

enum WaTemplateCategory {
  MARKETING
  UTILITY
  AUTHENTICATION
}

enum WaTemplateStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  PAUSED
  DISABLED
}

enum WaHeaderFormat {
  TEXT
  IMAGE
  VIDEO
  DOCUMENT
  LOCATION
}

enum Purpose {
  general
  welcome
  follow_up
  reminder
  event
  announcement
  support
  promotion
}

model MessageTemplate {
  id              String             @id @default(uuid())
  userId          String             @map("user_id")
  user            User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  name            String
  displayName     String             @map("display_name")
  language        String             @default("en")
  category        WaTemplateCategory @default(MARKETING)
  purpose         Purpose            @default(general)

  status          WaTemplateStatus   @default(DRAFT)
  waTemplateId    String?            @map("wa_template_id")
  waAccountId     String?            @map("wa_account_id")
  rejectionReason String?            @map("rejection_reason") @db.Text

  headerFormat    WaHeaderFormat?    @map("header_format")
  headerText      String?            @map("header_text")
  headerVars      String[]           @default([]) @map("header_vars")

  bodyText        String             @map("body_text") @db.Text
  bodyVars        String[]           @default([]) @map("body_vars")

  footerText      String?            @map("footer_text")
  buttons         Json               @default("[]")

  channel         MessageChannel     @default(whatsapp)
  smsBody         String             @map("sms_body") @db.Text
  smsVars         String[]           @default([]) @map("sms_vars")

  scenarioId      String?            @map("scenario_id")
  isDefault       Boolean            @default(false) @map("is_default")

  usageCount      Int                @default(0) @map("usage_count")
  lastUsedAt      DateTime?          @map("last_used_at")
  submittedAt     DateTime?          @map("submitted_at")
  approvedAt      DateTime?          @map("approved_at")

  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt      @map("updated_at")

  @@index([userId])
  @@index([userId, purpose])
  @@index([userId, scenarioId])
  @@index([userId, scenarioId, isDefault])
  @@index([createdAt(sort: Desc)])
  @@index([userId, channel])
  @@index([userId, status])
  @@index([userId, category])
  @@map("message_templates")
}

model SenderNumber {
  id         String         @id @default(uuid())
  userId     String         @map("user_id")
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  number     String
  label      String?
  channel    MessageChannel
  isActive   Boolean        @default(true) @map("is_active")

  lastUsedAt DateTime?      @map("last_used_at")
  sentCount  Int            @default(0) @map("sent_count")

  createdAt  DateTime       @default(now()) @map("created_at")
  updatedAt  DateTime       @updatedAt      @map("updated_at")

  @@index([userId, channel, isActive])
  @@map("sender_numbers")
}

// ─── Workspace and Team Foundation ────────────────────────────────────────────

enum OrgRole {
  OWNER
  ADMIN
  MEMBER
}

enum JoinRequestStatus {
  pending
  approved
  declined
}

model OrgInvite {
  id        String   @id @default(cuid())
  ownerId   String   @map("owner_id")
  owner     User     @relation("OrgInvitesSent", fields: [ownerId], references: [id], onDelete: Cascade)

  email     String
  role      OrgRole  @default(MEMBER)
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  accepted  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  @@index([ownerId])
  @@index([token])
  @@map("org_invites")
}

model OrgMember {
  id       String   @id @default(cuid())
  ownerId  String   @map("owner_id")
  owner    User     @relation("OrgMembersOwned", fields: [ownerId], references: [id], onDelete: Cascade)

  userId   String   @map("user_id")
  user     User     @relation("OrgMemberships", fields: [userId], references: [id], onDelete: Cascade)

  role     OrgRole  @default(MEMBER)
  joinedAt DateTime @default(now()) @map("joined_at")

  @@unique([ownerId, userId])
  @@index([userId])
  @@map("org_members")
}

model OrgJoinRequest {
  id        String            @id @default(cuid())
  ownerId   String            @map("owner_id")
  owner     User              @relation("OrgJoinRequestsOwned", fields: [ownerId], references: [id], onDelete: Cascade)

  userId    String            @map("user_id")
  user      User              @relation("OrgJoinRequestsSent", fields: [userId], references: [id], onDelete: Cascade)

  message   String?           @db.Text
  status    JoinRequestStatus @default(pending)
  decidedAt DateTime?         @map("decided_at")
  createdAt DateTime          @default(now()) @map("created_at")

  @@unique([ownerId, userId])
  @@index([ownerId, status])
  @@index([userId])
  @@map("org_join_requests")
}
```

**State transitions**:
- Contact lifecycle: raw input &rarr; phone sanitized to E.164 &rarr; active contact &rarr; optional opt out.
- ParseJob lifecycle: `pending` &rarr; `parsing` &rarr; `done` (or `error`).
- Campaign lifecycle: `pending` &rarr; `processing` &rarr; `completed` (or `failed`).
- Message dispatch lifecycle: `queued` &rarr; `sending` &rarr; `sent` &rarr; `delivered` (or `failed` / `rate_limited`).
- Transaction ledger lifecycle: `pending` &rarr; `completed` (or `failed` / `reversed`).

**API surface**:

| Surface / Method | Type | Key inputs | Key outputs | Auth | Purpose |
|---|---|---|---|---|---|
| `bun run db:migrate` | CLI command | PostgreSQL connection string | Migration SQL applied | Local / CI env | Applies incremental schema changes safely |
| `bun run db:generate` | CLI command | `prisma/schema.prisma` | Updated client in `src/generated/prisma` | Local / CI env | Regenerates type safe Prisma Client bindings |
| `src/db.ts` | Module export | None | Singleton client and exported model types | Application internal | Provides database access across all routers and jobs |
| `src/features/billing/billing.router.ts` | ORPC router | Deposit inputs, wallet queries | Wallet balance, transaction records | Protected session | Prunes subscription endpoints to focus on prepaid wallet |
| `src/features/contacts/server/router.ts` | ORPC router | Contact fields, search params | Paginated contacts, contact record | Protected session | Drops synthetic parse job creation on manual insert |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Read wallet balance | `balanceKobo`, `heldKobo` | DB columns on `Wallet` table |
| Record top up deposit | `amountKobo`, `balanceAfterKobo`, `reference` | Input params plus Paystack verification result |
| Add manual contact | `name`, `phone`, `tags` | Input params sanitized to E.164 with `parseJobId: null` |
| Track SMS delivery | `termiiMessageId` | Termii dispatch response or inbound delivery webhook |
| Track WhatsApp delivery | `metaMessageId` | Meta Cloud API dispatch response or inbound webhook |
| Resolve inbound reply | `serviceWindowActive` | Derived from `now() - inboundMessage.receivedAt <= 24h` |

**Key invariants**:
- Currency values are stored strictly as positive integers representing kobo (100 kobo equals 1 Naira).
- Database check constraint enforces that wallet balance is never lower than held funds: `CHECK (balance_kobo >= held_kobo)`.
- Phone numbers are validated and sanitized to standard E.164 format in shared Zod schemas before database insertion.
- Contact phone number must be unique per user account (`@@unique([uploadedBy, phone])`).
- Outbound SMS messages record their Termii message reference in `termiiMessageId`.
- Transaction records are immutable append only entries; balance calculations reflect cumulative ledger entries.

**Security model**:
- All operations require an authenticated session via Better Auth middleware.
- Data access is strictly scoped to the authenticated `userId` or `uploadedBy`.
- When an organization membership exists in `OrgMember`, workspace data access is delegated based on `ownerId`.
- Financial ledger records are protected against client tampering by calculating balance updates exclusively inside database transactions on the server.

**Configuration required**:
- `DATABASE_URL`: PostgreSQL connection string for local development.
- `PROD_DATABASE_URL`: PostgreSQL connection string for production deployment when `PROD=true`.

**Critical test scenarios**:
- Happy path: Saving a manual contact without a parse job and creating a campaign with reserved wallet funds, verifies **AC-1**, **AC-3**, **AC-5**.
- Duplicate rejection: Inserting a duplicate phone number for the same user account triggers a unique constraint error, verifies **AC-4**.
- SMS tracking: Dispatching an SMS and recording the Termii identifier in `termiiMessageId` for webhook matching, verifies **AC-2**.
- Financial ledger: Crediting a wallet and recording an immutable deposit transaction with updated `balanceAfterKobo`, verifies **AC-6**.
- Schema integrity: Executing `prisma validate` and running the incremental migration without syntax or relation errors, verifies **AC-8**, **AC-9**.

## Build plan

- [x] 1. Update `prisma/schema.prisma` to drop the `Subscription` model, remove `twilioSid`, make `Contact.parseJobId` optional, add `tags` and `termiiMessageId`, and fix one to one user relations, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-6**, **AC-7**.
- [x] 2. Add composite indexes across `transactions`, `campaigns`, `messages`, `contacts`, and `inbound_messages` in `prisma/schema.prisma`, satisfies **AC-8**.
- [x] 3. Generate and apply the incremental database migration with automated contact deduplication and wallet check constraint using `bun run db:migrate`, satisfies **AC-4**, **AC-9**.
- [x] 4. Prune deprecated subscription procedures (`getSubscription`, `initSubscription`, `cancelSubscription`) from `src/features/billing/billing.router.ts`, satisfies **AC-6**.
- [x] 5. Update `src/features/contacts/server/router.ts` to omit synthetic parse job creation on manual contact inserts, satisfies **AC-3**, **AC-4**.
- [x] 6. Update `src/db.ts` type exports and regenerate Prisma Client using `bun run db:generate`, satisfies **AC-1**, **AC-9**.

## Consequences

**Positive**:
- Database schema matches the actual architecture of prepaid kobo billing, Termii SMS, and Meta WhatsApp.
- Eliminates synthetic `ParseJob` rows on manual contact additions and CSV imports.
- Replaces plural array relations on one to one models with clean singular types.
- Composite indexes significantly improve lookup performance for campaign status, wallet history, and contact search.

**Negative / tradeoffs**:
- Removing subscription endpoints from the billing router requires any interface referencing monthly plans to be redirected to prepaid wallet balances; frontend adjustments are tracked as part of Feature 5 (Prepaid wallet and Paystack deposit).
- Historical Twilio message references in `twilioSid` and existing development subscription records are permanently discarded without data migration or prorated credit.

**Neutral**:
- Team models (`OrgMember`, `OrgInvite`, `OrgJoinRequest`) remain in the schema for multi user workspace readiness without affecting single user workflows.

## Migration plan

**Strategy**: Safe incremental migration using standard Prisma migration tooling with automated SQL data sanitization.

**Phases**:
1. Schema update: Update `prisma/schema.prisma` with optional `parse_job_id`, new indexes, `termii_message_id`, and remove `subscriptions`.
2. Automated deduplication in `migration.sql`:
   ```sql
   -- Deduplicate contacts per (uploaded_by, phone) keeping the latest record
   DELETE FROM contacts a USING contacts b
   WHERE a.uploaded_by = b.uploaded_by
     AND a.phone = b.phone
     AND a.created_at < b.created_at;

   -- Deduplicate wallets per user keeping the latest balance
   DELETE FROM wallets a USING wallets b
   WHERE a.user_id = b.user_id
     AND a.created_at < b.created_at;

   -- Enforce database level financial balance check
   ALTER TABLE wallets ADD CONSTRAINT check_balance_held CHECK (balance_kobo >= held_kobo);
   ```
3. Migration execution: Run `bun run db:migrate --name consolidate_schema_models` to generate and apply the SQL migration.
4. Client generation: Run `bun run db:generate` to refresh TypeScript types in `src/generated/prisma`.
5. Application code alignment: Remove dead subscription code in `billing.router.ts` and clean up contact insertion in `contacts/server/router.ts`.

**Rollback**:
If migration fails, revert the schema changes and restore previous table definitions using Prisma migrate commands. Because the migration drops the unused `subscriptions` table and `twilio_sid` column, any test data in those columns is intentionally discarded.

**Risks**:
The automated SQL deduplication step deletes duplicate contact rows if any exist in the local or remote database before applying the unique index.

## Follow-up

- [ ] Run `bun run fix` after updating router files to enforce Ultracite formatting and linting rules.
- [ ] Ensure Zod input schemas for contact creation enforce E.164 phone normalization before inserting records.
