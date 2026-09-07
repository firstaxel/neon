---
name: Velocast
description: Multi-channel broadcast and messaging console for organizations across SMS and WhatsApp.
colors:
  primary: "#18181b"
  primary-foreground: "#fafafa"
  canvas: "#ffffff"
  canvas-dark: "#18181b"
  card: "#ffffff"
  card-dark: "#18181b"
  muted: "#f4f4f5"
  muted-dark: "#27272a"
  muted-foreground: "#71717a"
  border: "#e4e4e7"
  border-dark: "rgba(255,255,255,0.1)"
  signal-emerald: "#25d366"
  telecom-blue: "#60a5fa"
  dispatch-indigo: "#6366f1"
  destructive: "#e11d48"
typography:
  display:
    fontFamily: "'Bricolage Grotesque', 'Inter Variable', sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "'Inter Variable', 'Geist', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Inter Variable', 'Geist', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Inter Variable', 'Geist', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'JetBrains Mono', 'Geist Mono', monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  stadium: "26px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.stadium}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.muted-dark}"
  button-secondary:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.stadium}"
    padding: "8px 16px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.stadium}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    rounded: "{rounded.stadium}"
    padding: "24px"
  input:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
  badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: "2px 8px"
---

# Design System: Velocast

## Overview

**Creative North Star: "The Tactile Dispatch Console"**

Velocast is designed as an ultra-responsive, ergonomic operations console for community and organization broadcasts. The interface rejects brittle corporate dashboard styling in favor of physical, confidence-inspiring controls: generous stadium-radius cards (`26px`), pill-shaped tactile buttons, and clean hairline perimeter rings (`ring-1 ring-foreground/5`). Every surface feels grounded, deliberate, and optimized for rapid scanning and unambiguous operational decision-making under high-volume pressure.

The visual atmosphere balances quiet discipline with focused telecom energy. Neutral canvases (Carbon Slate `#18181b` in dark mode, Clean Canvas `#ffffff` in light mode) establish a calm foundation, while high-clarity signal accents—WhatsApp Signal Emerald (`#25d366`), Telecom Blue (`#60a5fa`), and Dispatch Indigo (`#6366f1`)—guide attention strictly to dispatch channels, verification states, and wallet movements. Decorative gradients and gratuitous drop shadows are replaced by layered surface tonality and crisp micro-geometry.

On mobile and touch screens, the interface adapts effortlessly into a handheld dispatch tool. Inputs and buttons feature generous hit zones, high-contrast typography ensures readability under harsh outdoor lighting, and fluid tab navigation allows coordinators to toggle between live campaign progress, audience rosters, and wallet reserves without visual fatigue.

**Key Characteristics:**
- **Stadium & Pill Form Language:** High-curvature stadium containers (`rounded-4xl` / 26px) and pill buttons provide a distinctly physical, friendly tactile footprint.
- **Hairline Perimeter Framing:** Subtle 1px perimeter rings (`ring-1 ring-foreground/5`) define component edges without heavy contrasting borders.
- **Channel Purity:** Emerald and Blue accents are reserved exclusively for WhatsApp and SMS channel indicators, preventing cognitive confusion.
- **Financial Precision:** Currency, kobo values, and recipient counts are rendered with monospace clarity and strict alignment.

## Colors

The palette is rooted in deep neutral contrast accented by functional telecom signals.

### Primary
- **Carbon Slate** (`#18181b` in light mode text / dark mode canvas; `#fafafa` in dark mode text / light mode canvas): The bedrock tone for primary actions, titles, and foundational UI frames.

### Secondary
- **WhatsApp Signal Emerald** (`#25d366` / `#10b981`): Dedicated exclusively to WhatsApp template indicators, delivery confirmations, and positive verification states.
- **Telecom Blue** (`#60a5fa`): Dedicated exclusively to SMS routing badges, GSM segment counters, and carrier telemetry.

### Tertiary
- **Dispatch Indigo** (`#6366f1` / `#8b5cf6`): Used for promotional highlights, landing page energy, AI parsing indicators, and wizard action progress.

### Neutral
- **Clean Canvas** (`#ffffff`): Light mode primary background and crisp card surface.
- **Midnight Obsidian** (`#09090b` / `#18181b`): Dark mode application canvas and layered elevation base.
- **Soft Muted** (`#f4f4f5` light / `#27272a` dark): Secondary action fills, subtle tab tracks, input backgrounds, and disabled controls.
- **Muted Foreground** (`#71717a`): Helper text, table column headers, and secondary timestamps.
- **Perimeter Ring** (`#e4e4e7` light / `rgba(255,255,255,0.1)` dark): Hairline structural divider framing containers and dialogs.

### Named Rules
**The Signal Purity Rule.** Emerald (`#25d366`) and Telecom Blue (`#60a5fa`) are semantic channel colors. They may never be used for general styling, random iconography, or non-messaging decorations.
**The Kobo Exactitude Rule.** Any element presenting wallet balances, fees, or message debits must display the exact integer currency without rounding ambiguity, styled in high-legibility tabular format.

## Typography

**Display Font:** Bricolage Grotesque (fallback: 'Inter Variable', sans-serif)  
**Body Font:** Inter Variable (fallback: 'Geist', sans-serif)  
**Label/Mono Font:** JetBrains Mono (fallback: 'Geist Mono', monospace)

**Character:** Technical precision paired with human warmth. Tight display tracking conveys purposeful speed, while Inter delivers exceptional neutral legibility across tabular contact lists and campaign summaries.

### Hierarchy
- **Display** (Bold 700, `2.5rem` / `40px`, line-height `1.15`, letter-spacing `-0.03em`): Hero promotional headings, landing headlines, and high-level metric summaries.
- **Headline** (SemiBold 600, `1.75rem` / `28px`, line-height `1.25`, letter-spacing `-0.02em`): Section titles, onboarding step banners, and modal headers.
- **Title** (SemiBold 600, `1.125rem` / `18px`, line-height `1.4`, letter-spacing `-0.01em`): Card headings, dialog titles, and campaign list item labels.
- **Body** (Regular 400 & Medium 500, `0.875rem` / `14px`, line-height `1.5`, max-width `65ch`): Primary user interface copy, form labels, table cells, and message previews.
- **Label** (SemiBold 600, `0.75rem` / `12px`, line-height `1.3`, letter-spacing `0.05em`, uppercase in tags): Status tags, route breadcrumbs, GSM character counters, and transaction ledger references.

### Named Rules
**The Tabular Numbers Rule.** All numerical data in tables, wallet displays, phone lists, and segment calculators must use monospace or tabular figure formatting (`font-mono` / `tnum`) to ensure columns align perfectly.

## Layout

Velocast utilizes an adaptive fluid grid structured around an ergonomic central container:
- **Maximum App Container:** Centered `max-w-7xl` (1280px) on desktop dashboards, scaling down gracefully with consistent horizontal padding (`px-4` on mobile, `px-6` on tablet, `px-8` on desktop).
- **Navigation Shell:** Fixed-height top bar with logo scaling on scroll, paired with a sticky floating tab navigation bar (`AnimatedTabs`) featuring fluid indicator animations across routes.
- **Card Grid:** Responsive 1-to-3 column grids (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`) for campaigns, contact stats, and template previews.
- **Spacing Rhythm:** Built on an 8px modular baseline (`4px`, `8px`, `16px`, `24px`, `32px`, `48px`). Form inputs and related labels maintain a compact 6px gap (`gap-1.5`), while major card sections separate by 24px (`gap-6`).

## Elevation & Depth

Velocast rejects heavy skeuomorphic drop shadows, utilizing **Layered Surface Tonality with Hairline Perimeter Rings**. Depth is conveyed through background contrast progression rather than ambient blur: `bg-background` (base) → `bg-card` (elevated) → `bg-muted` (recessed inputs/wells).

### Shadow Vocabulary
- **Card Foundation** (`shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10`): Renders cards subtly suspended above the base canvas with a crisp 1px boundary.
- **Dialog & Sheet Popover** (`shadow-xl ring-1 ring-foreground/5 dark:ring-foreground/10`): Modals, dropdown menus, and slide-over drawers use deeper elevation with backdrop blur (`backdrop-blur-sm bg-black/30`).
- **Pill Active Indicator** (`shadow-xs` / `translate-y-px` on active): Micro-tactile feedback when buttons are clicked or pressed.

### Named Rules
**The Hairline Ring Rule.** Elevated containers must pair their soft elevation shadow with a 1px subtle perimeter ring (`ring-1 ring-foreground/5` in light, `ring-foreground/10` in dark). Borderless floating cards are prohibited.

## Shapes

The form language is defined by **hyper-rounded stadium curves**:
- **Primary Cards & Modals:** Stadium curvature (`rounded-4xl` = `26px`), delivering a distinctive softened silhouette.
- **Buttons & Chips:** Pill curvature (`rounded-4xl` for standard buttons, `rounded-full` for toggle tabs and filter chips).
- **Form Controls & Inputs:** Soft pill curvature (`rounded-3xl` = `22px`), creating cohesive visual synergy with button elements.
- **Status Badges:** Compact stadium capsules (`rounded-3xl` / `h-5`).
- **Dividers:** Ultra-thin hairlines (`h-px bg-border/60`).

## Components

### Buttons
- **Shape:** Pill / Stadium curvature (`rounded-4xl`, 26px radius).
- **Primary:** High-contrast solid fill (`bg-primary text-primary-foreground`), `h-9 px-4`, active state translation (`active:translate-y-px`).
- **Secondary:** Recessed neutral fill (`bg-secondary text-secondary-foreground hover:bg-secondary/80`).
- **Destructive:** Soft red wash (`bg-destructive/10 text-destructive hover:bg-destructive/20`).
- **Ghost / Link:** Flat with underline or background hover wash (`hover:bg-muted`).

### Cards & Containers
- **Corner Style:** Stadium curvature (`rounded-4xl`).
- **Background:** Crisp card surface (`bg-card`).
- **Framing:** Hairline perimeter ring (`ring-1 ring-foreground/5 dark:ring-foreground/10`) with `shadow-md`.
- **Internal Padding:** `p-6` (24px) default, `p-4` (16px) for compact cards.

### Inputs & Form Fields
- **Style:** Recessed stadium container (`rounded-3xl`, `bg-input/50`, `border border-transparent`, `h-9 px-3`).
- **Focus State:** Elevated perimeter ring (`focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30`).
- **Error State:** Crimson boundary warning (`aria-invalid:border-destructive aria-invalid:ring-destructive/20`).

### Channel Badges & Chips
- **WhatsApp Badge:** `border-[#25d36640] bg-[#0d2016] text-[#25d366] rounded-3xl h-5 px-2 font-mono text-xs`.
- **SMS Badge:** `border-[#60a5fa40] bg-[#0d1a2e] text-[#60a5fa] rounded-3xl h-5 px-2 font-mono text-xs`.

### Navigation (AnimatedTabs)
- **Track:** Recessed container (`rounded-full p-1 bg-muted`).
- **Trigger:** Rounded pill tab with sliding background highlight on hover and crisp active indicator line.

### Signature Component: Campaign Wizard Dispatch Summary
- Distinctive high-density card showing real-time recipient counts, GSM segments (e.g. `160 chars / 1 SMS`), estimated Paystack kobo wallet deduction, and channel delivery selector.

## Do's and Don'ts

### Do:
- **Do** wrap cards and dialogs in `rounded-4xl` with `ring-1 ring-foreground/5` for crisp perimeter framing.
- **Do** format all currency and financial values in integer kobo converted to standard Naira (`₦X,XXX.XX`) with tabular numbers (`font-mono`).
- **Do** restrict WhatsApp emerald (`#25d366`) and SMS telecom blue (`#60a5fa`) exclusively to channel-specific context.
- **Do** ensure all form controls maintain accessible focus rings (`focus-visible:ring-3 focus-visible:ring-ring/30`).
- **Do** use org-adaptive terminology (e.g. Members vs Beneficiaries vs Customers) from `src/features/miscellaneous/org.ts`.

### Don't:
- **Don't** use sharp square corners (`rounded-none` or `rounded-xs`) for buttons or cards; preserve the tactile stadium silhouette.
- **Don't** apply heavy, opaque drop shadows that muddy the background canvas; rely on layered surface tonality.
- **Don't** invent random neon accent colors outside the defined palette roles.
- **Don't** hide campaign cost estimates or wallet balances behind nested menus; surface them transparently before dispatch.
- **Don't** allow message textareas to omit GSM segment warnings when exceeding the 160-character threshold.
