# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary Users**: Administrators, coordinators, managers, and ministry/community leaders at organizations across Nigeria and West Africa—primarily faith-based organizations (churches, ministries), non-profits (NGOs, charities), schools/academies, community associations, and growing businesses/SMEs.
- **Situation**: They gather contacts through in-person events, physical services, paper sign-up sheets, attendance rosters, or CSV spreadsheets. They need to rapidly send event announcements, first-time attendee welcomes, follow-ups, pastoral or welfare check-ins, and broadcast updates via WhatsApp and SMS without manual typing or prohibitive SaaS complexity.
- **Job to be Done**: Digitize offline paper rosters into verified contacts via AI, top up prepaid campaign wallets in local currency (Naira), compose personalized messages with dynamic placeholders, dispatch multi-channel broadcasts, and monitor delivery confirmations and incoming replies.

## Product Purpose

- **What it does**: Velocast is a multi-channel broadcast and messaging console for organizations to reach their audiences via SMS (Termii) and WhatsApp (Meta Cloud API / Termii), with automated AI paper roster parsing (Google Gemini vision) and prepaid wallet billing (Paystack).
- **Why it exists**: Existing solutions either require manual spreadsheet collation and expensive international SaaS disconnected from African payment rails and local SMS deliverability, or rely on outdated bulk-SMS portals with poor UX, zero WhatsApp support, and no intelligent contact ingestion.
- **Success**: An administrator can photograph a handwritten or printed attendance roster, let Gemini AI extract structured names and phone numbers in seconds, fund their wallet instantly via Paystack, and deliver a personalized dual-channel campaign in under two minutes with clear per-recipient delivery confirmation.

## Positioning

- **Core Mechanism / Unfair Advantage**: The physical-to-digital broadcast pipeline: scanning physical attendance sheets and roster logs via Google Gemini vision parsing, turning them into structured contacts, and immediately routing them into verified dual-channel (WhatsApp + SMS) broadcast workflows backed by transparent, prepaid Paystack wallet billing.
- **Distinctive Claim**: Unlike generic bulk SMS or marketing automation platforms, Velocast bridges offline in-person gatherings to targeted digital messaging with zero manual data entry, featuring an org-adaptive taxonomy that dynamically flexes terminology (e.g. "Members & First Timers" for churches, "Partners & Beneficiaries" for NGOs, "Students & Parents" for schools, and "Clients & Leads" for businesses).

## Operating Context

- **Usage Environments**: Split between desktop laptops/workstations in organization offices and mobile web on smartphones used on-site at event check-in desks, service auditoriums, and community halls.
- **Source Materials**: Physical sign-in sheets, paper visitor registration books, event logs, camera snapshots, and uploaded CSV/Excel sheets.
- **Regional & Infrastructure Realities**: Tailored for Nigerian and West African market conditions:
  - Paystack instant checkout in Nigerian Naira (stored internally in integer kobo to prevent floating-point rounding errors).
  - Local telephone number normalisation (+234 / local prefix handling).
  - Termii SMS telecom routing with custom alphanumeric sender ID compliance and GSM segment character limits (160 standard / 70 unicode chars).
  - WhatsApp Meta 24-hour customer service window awareness (free-form replies within window, approved templates outside window).

## Capabilities and Constraints

- **Confirmed Functionality**:
  - **Multi-channel Broadcast**: SMS and WhatsApp campaign dispatch with full status lifecycle tracking (`queued`, `sending`, `sent`, `delivered`, `read`, `failed`, `rate_limited`, `opted_out`).
  - **AI Contact Sheet Parsing**: Google Gemini vision extraction converting roster photographs stored in Cloudflare R2 / S3 into structured contact records.
  - **Prepaid Paystack Wallet**: Real-time wallet balance management in kobo, Paystack deposit checkout, webhook credit confirmation, campaign pre-authorization holds, and immutable transaction ledgers.
  - **Contact Management & Tagging**: Address book with search, organization-specific contact classification, duplicate phone number detection, manual contact creation, and CSV import/export.
  - **Campaign Wizard**: Step-by-step campaign builder with dynamic placeholders (`{{name}}`), GSM segment calculation, cost estimation, audience selection, and Inngest background job fan-out execution.
  - **Adaptive Organization Profiles**: Tailors navigation labels, contact types, and campaign scenarios according to organization type (`church`, `ngo`, `school`, `business`, `community`).
  - **Two-Way Inbox**: Webhook handlers for inbound WhatsApp and SMS replies enabling conversational threads and real-time response capability.
- **Technical Constraints**:
  - Full-stack TanStack Start application with Nitro server, Vite bundler, and Bun runtime.
  - PostgreSQL database with Prisma ORM; all currency stored in integer kobo (`balanceKobo`, `amountKobo`).
  - End-to-end type safety using oRPC v2 and Standard Schema / Zod validation.
  - Inngest background queues for durable, retry-safe message fan-out and AI vision processing.
  - Authentication powered by Better Auth.
  - Code formatting and quality enforced by Ultracite (Biome).
- **Explicitly Deferred (Out of Scope for MVP)**:
  - Multi-user team invitations with granular RBAC permissions.
  - Rich HTML email newsletter broadcasting.
  - Automated drip campaigns and recurring calendar-based scheduling.
  - Public audience self-registration forms and QR code subscriber capture.
  - Public developer REST API and outbound webhooks.

## Brand Commitments

- **Name**: Velocast.
- **Voice & Tone**: Reliable, crisp, empowering, and respectful. Direct and functional for daily operations without fluff, respectful of mission-driven and faith-based organizations as well as commercial enterprises.
- **Visual Design Identity**: High-contrast interface, dark/light theme support, clean data tables and wizard steps, subtle accent emerald tones for WhatsApp familiarity, and prominent status badges for message states.

## Evidence on Hand

- **Repository Implementation**:
  - Prisma schema with complete `Wallet`, `Campaign`, `Contact`, `ParseJob`, `Message`, and `UserProfile` entities in [prisma/schema.prisma](file:///home/codeheart/Documents/source/neon/prisma/schema.prisma).
  - Defined product scope and roadmap in [docs/scope/scope.md](file:///home/codeheart/Documents/source/neon/docs/scope/scope.md).
  - Organization adaptive logic and terminology dictionary in [src/features/miscellaneous/org.ts](file:///home/codeheart/Documents/source/neon/src/features/miscellaneous/org.ts).
  - Metadata and site configuration in [src/lib/metadata.ts](file:///home/codeheart/Documents/source/neon/src/lib/metadata.ts).
  - Working route tree and feature components in `src/routes/` and `src/features/`.
- **Integrity Boundary**: No fabricated customer logos, fictitious partner testimonials, or unsubstantiated deliverability statistics in marketing or UI copy without explicit confirmation.

## Product Principles

- **Physical-First Capture**: Never assume users start with clean digital databases; optimize first and foremost for converting physical paper rosters and real-world sign-in sheets into digital broadcast audiences.
- **Financial Exactitude**: Treat organization funds with utmost integrity: every kobo is logged in an immutable ledger, and estimated campaign costs are surfaced transparently before any dispatch occurs.
- **Context-Adaptive Empathy**: Speak the user's natural language—churches serve "Members & First Timers", NGOs coordinate "Partners & Beneficiaries", schools guide "Students & Parents", and businesses engage "Clients & Leads".
- **Deliverability & Safety First**: Guard user sender reputation with automatic GSM segment calculations, phone number deduplication, and strict adherence to WhatsApp template and consent rules.
- **Resilience Over Speed**: Heavy operations (vision extraction, contact batch ingestion, multi-recipient dispatch) must run durably in background queues with automatic retries and progress tracking.

## Accessibility & Inclusion

- WCAG AA compliance across desktop and mobile form factors.
- High-contrast color hierarchy for readability on mobile screens in bright outdoor lighting.
- Accessible form controls, dialogs, and navigation primitives built on Radix UI / Base UI with full keyboard accessibility.
