# 0001. Design system and UI foundation

**Date**: 2026-09-06
**Status**: Approved

## Summary

This specification establishes the core design system and user interface foundation for Velocast. We standardize the tactile dispatch console visual language across tokens, accessible primitives, and responsive layout shells. The interface uses high curvature stadium components with subtle perimeter rings, clean telecom channel accents, and flicker free theme switching. This work provides the shared visual and structural building blocks for all subsequent feature screens.

## Requirements

**User stories**:
- As an organization administrator, I want a clean, responsive layout shell so that I can easily navigate between campaigns, contacts, templates, and billing.
- As an event coordinator on a smartphone, I want large touch accessible buttons and clear channel badges so that I can manage broadcasts accurately without misclicks.
- As a team member working in different environments, I want reliable theme switching between light, dark, and system modes without visual flash on page load.

**Acceptance criteria**:
- **AC-1**: Unified design tokens defined in `src/styles.css` matching `DESIGN.md` provide consistent colors, spacing, and radius variables (`rounded-4xl` for stadium curves, `rounded-3xl` for inputs) across light and dark modes.
- **AC-2**: Reusable primitive components (`Button`, `Input`, `Textarea`, `Card`, `Badge`, `Dialog`, `Tabs`) built on Base UI and Tailwind CSS v4 render with complete keyboard navigation, visible focus rings, and correct ARIA states.
- **AC-3**: The dashboard layout shell in `src/routes/(dashboard)/route.tsx` provides a persistent top bar with scroll scaling logo, route breadcrumbs, user menu, theme switcher, and sticky animated navigation tabs that highlight active routes.
- **AC-4**: Mobile viewports adapt dashboard navigation into an accessible accordion drawer dropdown with minimum 44px tap targets and zero horizontal overflow.
- **AC-5**: Theme switching supports light, dark, and system preference with zero flash of unstyled content on server rendered page loads.
- **AC-6**: Channel badges display dedicated semantic colors without ambiguity: WhatsApp Signal Emerald (`#25d366`) and SMS Telecom Blue (`#60a5fa`).

## Decision

**Chosen option**: Option 1: Base UI primitives with Tailwind CSS v4 and stadium curvature

We standardize on Base UI primitives paired with Tailwind CSS v4 tokens, preserving the tactile dispatch console aesthetic and responsive top navigation bar.

**Implementation skills**: `impeccable` (`pbakaus/impeccable`, `.agents/skills/impeccable/`)

## Feature design

**Data model sketch**:
No server database entities required for this foundational UI layer. Client state manages theme preference (`light`, `dark`, `system`) stored in local storage and cookies for server rendering.

**State transitions**:
- Theme mode: `system` (follows operating system) -> `light` -> `dark` -> `system`.
- Navigation tabs: idle -> tab hovered (sliding pill highlight) -> tab clicked (underline indicator moves to active route).
- Mobile navigation: collapsed (header button shows active label) -> expanded (drawer slides down with route links).

**API surface**:

| Component | Slot / Element | Key props | Styling tokens | Accessibility |
|---|---|---|---|---|
| Button | `button` | `variant`, `size` | `rounded-4xl`, `bg-primary`, `h-9` | Native button, visible focus ring |
| Input | `input` | `type`, `disabled` | `rounded-3xl`, `bg-input/50`, `h-9` | Label association, aria-invalid |
| Card | `div` | `size` | `rounded-4xl`, `bg-card`, `ring-1` | Container landmark |
| Badge | `span` | `variant` | `rounded-3xl`, `h-5`, `font-mono` | Status text role |
| Dialog | `dialog` | `open`, `onOpenChange` | `rounded-4xl`, `shadow-xl`, `backdrop-blur` | Focus trap, escape key close, portal |
| AnimatedTabs | `nav` | `tabs` | `rounded-full`, `bg-muted` | Tablist, tab, aria-selected |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Render page theme | Active theme class on root html | Client cookie or local storage, defaulted to system |
| Highlight active tab | Active indicator position and label | Current route pathname from TanStack Router |
| Render breadcrumb | Readable current section title | Pathname matching `ROUTE_LABELS` lookup table |
| Display channel badge | Emerald or blue badge style | Contact or template channel property |

**Key invariants**:
- The primary stadium curve (`rounded-4xl` = 26px) must be applied to all cards, dialog popups, and main buttons.
- Emerald green (`#25d366`) is strictly reserved for WhatsApp channels, and telecom blue (`#60a5fa`) is strictly reserved for SMS channels.
- All interactive controls must provide visible outline focus rings with at least 3px spread on keyboard navigation.
- Financial numbers and character counts must use monospace tabular typography (`font-mono`).

**Security model**:
- Pure client presentation and navigation components.
- No direct HTML string injection; all dynamic values rendered via safe React children.
- Theme cookie sanitized against strict allowed values (`light`, `dark`, `system`).

**Configuration required**:
- None. Uses existing Vite and Tailwind configuration.

**Critical test scenarios**:
- Happy path: User navigates between dashboard routes, observing smooth tab indicator transitions and correct active state, verifies **AC-3**.
- Responsive mobile path: User resizes viewport to mobile width, verifies navigation folds into an accordion drawer with 44px tap targets, verifies **AC-4**.
- Theme persistence: User toggles theme from light to dark and reloads the page, observing zero flash before paint, verifies **AC-5**.
- Accessible interaction: User navigates forms and dialog modals using keyboard Tab and Escape keys, observing active focus rings, verifies **AC-2**.
- Semantic channel verification: User inspects campaign channel badges, confirming distinct WhatsApp emerald and SMS telecom blue badges, verifies **AC-6**.

## Build plan

1. [x] Harmonize core token variables in `src/styles.css` ensuring `@theme inline` binds the stadium radius (`rounded-4xl` 26px, `rounded-3xl` 22px) and semantic channel colors, satisfies **AC-1**, **AC-6**.
2. [x] Standardize and verify core UI primitives (`Button`, `Input`, `Card`, `Badge`, `Dialog`) in `src/components/ui/` using Base UI and perimeter rings, satisfies **AC-2**, **AC-6**.
3. [x] Refine the dashboard layout shell and `AnimatedHeader` in `src/features/dashboard/components/` with sticky animated tabs and route breadcrumbs, satisfies **AC-3**.
4. [x] Harden the mobile navigation drawer in `src/features/dashboard/components/tabs.tsx` for touch tap targets and smooth accordion transitions, satisfies **AC-4**.
5. [x] Verify synchronous theme switcher in `src/features/dashboard/components/mode-toggle.tsx` and `__root.tsx` for light, dark, and system preference with zero paint flash, satisfies **AC-5**.

## Consequences

**Positive**:
- Eliminates visual inconsistency and redundant styling across feature teams.
- Establishes a distinct, tactile brand silhouette with production grade accessibility.
- Accelerates subsequent broadcast, contact, and wallet feature delivery.

**Negative / tradeoffs**:
- Custom stadium radius requires disciplined usage rather than generic copy paste UI snippets.
- Base UI requires manual styling integration compared to prebuilt component suites.

**Neutral**:
- Team members need to reference `DESIGN.md` and `src/components/ui/` rather than adding one off custom CSS.

## Follow up

- [ ] Audit existing contact and campaign views to replace any remaining one off raw buttons with the standardized `Button` component.
- [ ] Implement responsive data table wrappers with horizontal scrolling indicators for dense recipient logs.
