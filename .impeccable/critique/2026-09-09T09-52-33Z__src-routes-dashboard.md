---
target: src/routes/(dashboard)*
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/codeheart/Documents/source/neon/src/routes/(dashboard)"
timestamp: 2026-09-09T09-52-33Z
slug: src-routes-dashboard
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live campaign sending and WA window timers are clear; parsing progress lacks granular stage feedback. |
| 2 | Match System / Real World | 4 | Superb domain alignment: integer kobo / Naira rates, GSM segment character limits, org-adaptive terminology. |
| 3 | User Control and Freedom | 3 | Clean wizard back buttons and dialog exits; lacks broadcast cancel-in-flight or undo capabilities. |
| 4 | Consistency and Standards | 2 | Framework mismatch (`next/link` in TanStack Start), broken WhatsApp edit route, divergent `PageHeader` patterns. |
| 5 | Error Prevention | 3 | Robust deposit limits, sender ID character validation, and account deletion confirmation guards. |
| 6 | Recognition Rather Than Recall | 3 | Distinct channel badges (WhatsApp emerald, SMS sky blue); some filters split across URL and component state. |
| 7 | Flexibility and Efficiency | 2 | Inbox has ⌘↵ keyboard send, but lacks global shortcuts, command palette (⌘K), or batch contact actions. |
| 8 | Aesthetic and Minimalist Design | 3 | Distinctive tactile stadium curves; marred by arbitrary `text-[9px]` type ramp drift and squished plan cards. |
| 9 | Error Recovery | 3 | Paystack failure messages and service window warnings are clear; some raw server errors lack recovery paths. |
| 10 | Help and Documentation | 2 | Good inline telecom notices (Termii NCC approval); lacks in-app FAQ, deliverability guides, or documentation links. |
| **Total** | | **28/40** | **Good** |

### Design Specificity Verdict

**LLM assessment**: Velocast exhibits exceptionally strong domain-specific product character. It is emphatically not a generic SaaS clone: the UI explicitly accounts for Nigerian telecom realities (Termii SMS alphanumeric sender IDs, NCC approval delays, GSM 160-character segment boundaries), Paystack prepaid wallet billing in integer kobo with Naira conversion, WhatsApp 24-hour service window pricing dynamics (₦1 vs ₦9 template charges), and organ-adaptive terminology across faith-based, non-profit, educational, and commercial organizations. However, the surface execution is fragmented across routes, with inconsistent container widths, mixed layout architectures, broken route linkages, and unstandardized micro-typography.

**Deterministic scan**: CLI scan on `src/routes/(dashboard)` returned 0 findings directly due to thin route delegation. When scanning the underlying feature components in `src/features/` rendered by these routes, the detector flagged 14+ advisory violations of the DESIGN.md typography scale (`text-[9px]`, `text-[10px]`, `text-[11px]` off the documented type ramp) across `template-view.tsx` and `whatsapp-list-view.tsx`.

**Visual overlays**: Headless browser automation is unavailable in this environment. No reliable user-visible overlay was injected; evaluation proceeded via static and code analysis fallback signal.

### Overall Impression
Velocast has built an authentic, culturally and commercially tailored workflow engine for West African broadcast communication. Its core workflows (campaign wizard, billing ledger, 24-hour inbox window) are grounded in reality. The primary opportunity is unifying its architectural seams: eliminating legacy Next.js imports, standardizing page container geometry, fixing dead route links, and establishing typography discipline.

### What's Working
1. **Domain-Grounded Channel & Financial Mechanics**: The 24-hour WhatsApp countdown timer with clear service rate badges (₦1 vs ₦9), the GSM segment counter on SMS composers, and the transparent Paystack wallet ledger with kobo precision provide immense operational trust.
2. **Context-Adaptive Organization Taxonomy**: Dynamic switching between Church ("Members & First Timers"), NGO ("Partners & Beneficiaries"), School ("Students & Parents"), and Business profiles creates an immediate feeling of belonging without custom forks.
3. **Ergonomic Stadium Form Language**: The consistent pill-shaped buttons, stadium badges, and segmented toggles give the application a distinct, friendly tactile personality.

### Priority Issues

- **[P1] Broken Route Linkage in Templates View**: In `src/features/templates/view/template-view.tsx`, the edit handler links to `/template/whatsapp/${id}` (singular), which neither exists in the router nor matches the plural `/templates/` pattern. Clicking edit on any WhatsApp template results in a 404 unhandled route error.
  - *Why it matters*: Users cannot view, inspect, or manage existing WhatsApp templates after creating them.
  - *Fix*: Create the `src/routes/(dashboard)/templates/whatsapp/$templateId/index.tsx` route and update `editHref` to use the correct pluralized route path.
  - *Suggested command*: `$impeccable harden`

- **[P1] Framework Contamination & Inline Styles in Campaign Detail**: `src/features/campaigns/view/campaign-detail-view.tsx` imports `Link` from `next/link` inside a TanStack Start application, and employs hardcoded inline styles (`style={{ margin: "0 auto", maxWidth: 900, padding: "32px 28px" }}`) instead of Tailwind tokens.
  - *Why it matters*: Violates project architecture, risks runtime navigation failures, and breaks responsive container fluidity.
  - *Fix*: Replace `next/link` with `@tanstack/react-router` `Link`, and refactor inline styles into standard Tailwind responsive container utilities matching the rest of the app (`max-w-6xl mx-auto px-4 py-8`).
  - *Suggested command*: `$impeccable polish`

- **[P2] Container Width & Header Architecture Fragmentation**: The 15 dashboard routes diverge wildly in container sizing and header patterns. `dashboard` uses `max-w-7xl`, `billing` and `contacts` use `max-w-6xl`, `settings` uses `max-w-2xl`, and `campaign-detail` hardcodes `900px`. Furthermore, `BillingView` invents custom `h1` markup while `CampaignsView` and `TemplatesView` use `PageHeader`.
  - *Why it matters*: Jumping between tabs causes jarring horizontal layout shifts and inconsistent visual hierarchy.
  - *Fix*: Standardize on an adaptive container rhythm (`max-w-6xl` default for content views, `max-w-7xl` for high-density tables/dashboards) and enforce `PageHeader` across all route roots.
  - *Suggested command*: `$impeccable layout`

- **[P2] Type Ramp Drift & Illegible Micro-Typography**: Dozens of status badges, timestamps, and metadata pills rely on arbitrary sub-scale classes (`text-[9px]`, `text-[10px]`, `text-[11px]`).
  - *Why it matters*: Sub-12px typography is unreadable on mobile devices outdoors or in low-contrast ambient light, failing accessibility standards and violating DESIGN.md.
  - *Fix*: Normalize all micro-copy to `text-xs` (12px) with medium/semibold tracking, or explicitly update DESIGN.md if an ultra-compact tag size is formally adopted.
  - *Suggested command*: `$impeccable typeset`

- **[P2] Mobile Squeeze & Single-Column Desktop Layout in Billing**: In `BillingView`, subscription plans are displayed in a `flex gap-2.5` container that overflows or squishes on smaller viewports, while on desktop the entire view is constrained to a single column despite comments indicating a two-column intent.
  - *Why it matters*: Destroys scannability on desktop monitors and clips plan benefits on mobile devices.
  - *Fix*: Restructure Billing into a responsive 12-column grid (`grid-cols-1 lg:grid-cols-12`) with plans placed in a responsive card grid (`grid-cols-1 sm:grid-cols-3`).
  - *Suggested command*: `$impeccable adapt`

### Per-File Route Review (15 File Paths)

1. **`src/routes/(dashboard)/route.tsx`**
   - *Role*: Top-level dashboard layout shell.
   - *Findings*: Includes `useOnboardingGuard` and `AnimatedHeader`. However, the root `<main className="flex w-full flex-col items-center">` centers the container but lacks min-height styling (`min-h-screen`), causing page footer collapse on short views.

2. **`src/routes/(dashboard)/dashboard/index.tsx`**
   - *Role*: Dashboard home overview.
   - *Findings*: Well-structured stat cards (`Total Contacts`, `Campaigns`, `Messages Sent`) with tabular numbers and direct links. However, `Uploader` and `ParseJobCard` sections lack empty state guidance when no jobs exist, and the greeting does not adapt to the organization profile.

3. **`src/routes/(dashboard)/campaigns/index.tsx`**
   - *Role*: Campaign history listing.
   - *Findings*: Clean route delegating to `CampaignsView`. Uses standard `PageHeader` with a "New Campaign" action button. Needs clearer empty state messaging when zero campaigns have been dispatched.

4. **`src/routes/(dashboard)/campaigns/create/index.tsx`**
   - *Role*: Multi-step broadcast campaign wizard.
   - *Findings*: The 5-step wizard (`Scenario`, `Contacts`, `Review`, `Variables`, `Send`) is functionally rich, incorporating real-time Paystack cost estimation and GSM segment counters. However, Step 4 (Variables) places high cognitive load on users when many template variables are present.

5. **`src/routes/(dashboard)/campaigns/$campaignId/index.tsx`**
   - *Role*: Real-time campaign tracking and message log.
   - *Findings*: Critical defect: imports `Link` from `next/link` and uses inline `style={{ maxWidth: 900 }}`. Live progress pulse and status dots are excellent, but delivery failure errors are truncated to `max-w-40` without full tooltip expansion.

6. **`src/routes/(dashboard)/contacts/index.tsx`**
   - *Role*: Contact management and audience lists.
   - *Findings*: Good tabular layout and pagination. Flaw: Action buttons (`Export` and `Add Contact`) are placed in a sibling `div` alongside `PageHeader` rather than utilizing `PageHeader`'s native `action` prop, causing awkward flex alignment on narrow screens.

7. **`src/routes/(dashboard)/messages/index.tsx`**
   - *Role*: Two-way messaging inbox (WhatsApp & SMS).
   - *Findings*: Superb live 24-hour service window countdown and channel badges. Flaw: On desktop, when no conversation is selected, the helper cards take up excessive space with placeholder text ("AI auto-reply coming soon") that cannot be dismissed.

8. **`src/routes/(dashboard)/templates/index.tsx`**
   - *Role*: Message template library and channel toggles.
   - *Findings*: Critical defect: `editHref` points to `/template/whatsapp/${id}` which does not exist in the routing tree. Channel toggle tabs (WhatsApp emerald vs SMS blue) look great, but the status pill toolbar has empty placeholder elements.

9. **`src/routes/(dashboard)/templates/create/sms/index.tsx`**
   - *Role*: SMS template creator.
   - *Findings*: Clean creation flow with live character counter and GSM segment calculations. Lacks pre-built template suggestions based on the user's selected organization type.

10. **`src/routes/(dashboard)/templates/create/whatsapp/index.tsx`**
    - *Role*: Meta-compliant WhatsApp template composer.
    - *Findings*: Enforces header, body, and footer requirements for Meta approval. Missing visual preview of how the WhatsApp chat bubble will appear on a recipient's phone.

11. **`src/routes/(dashboard)/templates/sms/$templateId/index.tsx`**
    - *Role*: SMS template editor.
    - *Findings*: Appropriately loads template data and provides editing controls. Missing an indication of whether the template is currently in use by active or scheduled campaigns before saving changes.

12. **`src/routes/(dashboard)/billing/index.tsx`**
    - *Role*: Prepaid wallet and subscription management.
    - *Findings*: Layout collapse: plans use `flex gap-2.5` that squishes horizontally. The page does not use `PageHeader`, creating an inconsistent header treatment compared to all other dashboard pages.

13. **`src/routes/(dashboard)/billing/verify/index.tsx`**
    - *Role*: Paystack return verification handler.
    - *Findings*: Very clear state transitions (`loading` -> `success` / `error`) with prominent Naira amount formatting. Auto-redirect timeout (3.5s) is good, but the "Go now" link is easy to miss if the user wants to return immediately.

14. **`src/routes/(dashboard)/settings/index.tsx`**
    - *Role*: Organization profile, SMS sender ID, and account controls.
    - *Findings*: Well-organized sections. SMS sender ID section contains crucial local regulatory guidance (Termii & NCC 2-5 day delay). Danger zone account deletion is appropriately guarded with email confirmation.

15. **`src/routes/(dashboard)/onboarding/index.tsx`**
    - *Role*: First-time organization setup wizard.
    - *Findings*: Multi-step wizard correctly captures organization type, name, size, sender ID, and initial deposit. However, users who drop out midway cannot easily resume from a distinct URL state.

### Persona Red Flags

- **Alex (Power User)**:
  - No keyboard accelerators to navigate between tabs (e.g. `g c` for campaigns, `g b` for billing).
  - No bulk select or batch operations on contacts or conversation messages.
  - Must click through 5 wizard steps for every single broadcast with no "Quick Send" or "Duplicate Previous" option.

- **Jordan (First-Timer)**:
  - Hits a 404 when clicking edit on WhatsApp templates from the template list.
  - Confused by the difference between "Marketing (₦100)" vs "Utility Prescreen (₦5)" delivery modes in the campaign wizard without clear plain-language trade-offs.
  - Wonders why SMS sender IDs remain "Pending approval" without an estimated completion date.

- **Sam (Accessibility-Dependent)**:
  - Micro-typography (`text-[9px]`, `text-[10px]`) in status badges and timestamps fails WCAG AA minimum contrast and legibility thresholds.
  - Inline custom styles in `CampaignDetailView` bypass global responsive accessibility zoom rules.
  - Icon-only refresh buttons lack accessible screen-reader labels in several card headers.

- **Riley (Deliberate Stress Tester)**:
  - Long organization names (e.g. "The Redeemed Christian Church of God, Province 4 Youth Fellowship") break layout bounds in `SettingsView` and `AnimatedHeader`.
  - Submitting campaigns with 0 contacts selected leaves the wizard in an ambiguous state before the send button is disabled.

- **Casey (Distracted Mobile User)**:
  - On mobile screens, the `AnimatedHeader` tabs shift and top bar icons crowd the logo.
  - In `BillingView`, subscription cards squish and require horizontal panning.
  - Form save buttons in `SettingsView` are located at the bottom right of each card, outside the natural thumb reach zone on tall smartphones.

- **Pastor Emmanuel (Faith-Based Administrator - Project Persona)**:
  - Needs to quickly send an urgent service reminder to 1,200 church members on Sunday morning; gets slowed down by having to re-select variables and review delivery modes every time.
  - Lacks a simple "Low Wallet Balance" SMS or email alert before Sunday service broadcasts.

### Minor Observations
- `src/features/dashboard/components/header.tsx` uses custom scroll event listeners with manual scale animations (`logoScale = Math.max(0.75, 1 - scrollY * 0.006)`) that can cause minor layout jank during fast scrolling.
- `DepositDialog` amount buttons use `₦` symbol directly; should ensure `font-mono tabular-nums` is consistently applied to all currency text.
- `ModeToggle` in the top bar lacks a tooltip explaining what it does.

### Questions to Consider
1. *What if the Campaign Wizard allowed a 1-click "Quick Broadcast" using the last successful campaign's settings for recurring weekly events?*
2. *Can the WhatsApp and SMS template management be unified into a cohesive multi-channel preview card instead of separate split tabs?*
3. *How might the Billing dashboard surface projected campaign run-rate so administrators know exactly when their prepaid wallet will run out?*
