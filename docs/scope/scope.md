# Scope: Velocast

A modern multi channel broadcast and messaging platform for organizations to reach audiences via SMS and WhatsApp with prepaid Paystack billing and AI contact parsing.

**Build approach:** Tracer Bullet (prove the whole pipe works end to end before thickening breadth).
**Workflow:** Beta (/check verify then /test). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Stack and runtime foundation | Foundation | existing |
| B | Procedure API router | Foundation | existing |
| C | Durable background queues | Foundation | existing |
| 1 | Design system and UI foundation | Foundation | planned |
| 2 | Data model consolidation | Foundation | in-progress |
| 3 | Landing page and brand identity | Foundation | planned |
| 4 | Auth and onboarding flow | Slice 1 | planned |
| 5 | Prepaid wallet and Paystack deposit | Slice 1 | planned |
| 6 | Contact management and CSV import | Slice 1 | planned |
| 7 | SMS campaign wizard and Termii dispatch | Slice 1 | planned |
| 8 | Gemini AI contact sheet image parsing | Slice 2 | planned |
| 9 | WhatsApp outreach and template manager | Slice 2 | planned |
| 10 | Delivery analytics and campaign reports | Slice 2 | planned |
| 11 | Inbox and two way conversation thread | Slice 2 | planned |

## Enrolled existing code

### A. Stack and runtime foundation · existing
TanStack Start with Nitro and Vite on Bun runtime with Ultracite formatting and linting. code in `./`

### B. Procedure API router · existing
Type safe oRPC procedure router exposing OpenAPI documentation and client hooks. code in `src/orpc/`

### C. Durable background queues · existing
Inngest client and edge serve endpoint for event driven background job execution. code in `src/routes/api/inngest.ts`

## Foundations

### 1. Design system and UI foundation · needs a decision
Unified design tokens, Tailwind CSS v4 variables, Radix UI primitives, responsive layout shell, and theme switching.
**Done when:** reusable layout primitives, navigation sidebar, theme toggle, and base accessible inputs render consistently.
- [ ] Design it (spec): `/architect design system and UI foundation`

### 2. Data model consolidation · in-progress · needs a decision
Refactor Prisma schema to remove deprecated fields, enforce phone number uniqueness, index critical relations, and establish clean migrations.
**Done when:** consolidated PostgreSQL schema passes validation and supports wallet balances, contacts, campaigns, and delivery logs cleanly.
- [ ] Design it (spec): `/architect data model consolidation`
code in `prisma/`

### 3. Landing page and brand identity · needs a decision
Decompose the monolithic landing page into modern, responsive sections with clear Velocast brand identity, value propositions, and live pricing preview.
**Done when:** public landing page loads fast with modular components, responsive mobile layout, accurate brand copy, and search metadata.
- [ ] Design it (spec): `/architect landing page and brand identity`

## Slice 1: Core broadcast loop

### 4. Auth and onboarding flow · needs a decision
Streamlined authentication via Better Auth with email verification, secure session middleware, and organization profile setup.
**Done when:** a user can register, verify email, log in, configure sender identity, and reach the dashboard protected by server middleware.
- [ ] Design it (spec): `/architect auth and onboarding flow`

### 5. Prepaid wallet and Paystack deposit · needs a decision
Wallet balance management with instant Paystack checkout, webhook verification, and balance deduction protection.
**Done when:** a user can initiate a deposit in naira, complete Paystack payment, receive credited kobo balance via verified webhook, and inspect transactions.
- [ ] Design it (spec): `/architect prepaid wallet and Paystack deposit`

### 6. Contact management and CSV import · needs a decision
Full contact address book with tag support, search, duplicate detection, and batch CSV file upload with validation.
**Done when:** a user can view paginated contacts, add a contact with valid phone number, import contacts from CSV, and resolve duplicate numbers.
- [ ] Design it (spec): `/architect contact management and CSV import`

### 7. SMS campaign wizard and Termii dispatch · needs a decision
Campaign creation flow with audience selection, dynamic name placeholders, GSM segment calculation, wallet deduction, and Inngest fan out dispatch via Termii.
**Done when:** a user can launch an SMS campaign to selected contacts, wallet balance is reserved, messages are dispatched through Termii, and delivery status updates.
- [ ] Design it (spec): `/architect SMS campaign wizard and Termii dispatch`

## Slice 2: Channel expansion and insights

### 8. Gemini AI contact sheet image parsing · needs a decision
Camera or file upload of roster sheets, presigned upload to storage, and Inngest background extraction via Google Gemini vision model.
**Done when:** an uploaded image of a handwritten or printed list is parsed into structured names and phone numbers for review and one click import.
- [ ] Design it (spec): `/architect Gemini AI contact sheet image parsing`

### 9. WhatsApp outreach and template manager · needs a decision
Meta Cloud API integration for template synchronization, template approval tracking, broadcast dispatch, and message failure handling.
**Done when:** approved WhatsApp templates can be selected, mapped to contact variables, and delivered via WhatsApp with status updates.
- [ ] Design it (spec): `/architect WhatsApp outreach and template manager`

### 10. Delivery analytics and campaign reports · needs a decision
Real time delivery metrics displaying sent counts, delivery confirmations, failure reasons, and per campaign cost breakdown.
**Done when:** a user can inspect any past campaign to view delivery percentage, recipient status log, and financial deduction details.
- [ ] Design it (spec): `/architect delivery analytics and campaign reports`

### 11. Inbox and two way conversation thread · needs a decision
Centralized inbox receiving incoming customer replies from WhatsApp and SMS webhooks with conversation view and reply capability.
**Done when:** inbound replies appear in real time conversation threads with read status and outbound direct response sending.
- [ ] Design it (spec): `/architect inbox and two way conversation thread`

## Deferred
Out of scope for the MVP build pass, recorded here to keep the plan honest.
- **Team collaboration and roles**: multi user organization invitations and permission management (Admin, Member, Viewer) · needs a decision
- **Email marketing campaigns**: rich HTML newsletter broadcast with unsubscribe management · needs a decision
- **Scheduled and recurring broadcasts**: calendar based scheduling and drip follow up sequences · needs a decision
- **Public audience opt in forms**: shareable registration pages and QR code subscriber capture · needs a decision
- **Developer API and webhooks**: public REST API with personal access tokens and outbound event webhooks · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier last stage (`Prototype` after `/develop`; `Alpha` after `/check verify`; `Beta`/`GA` after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards and tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec ## Build plan, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature rigor above or below the project default; no tag inherits the default. It decides the feature check boxes and each skill next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
