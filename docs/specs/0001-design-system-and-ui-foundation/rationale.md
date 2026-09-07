# 0001. Design system and UI foundation (Rationale)

**Date**: 2026-09-06
**Status**: Approved

## Context

Velocast serves organizational coordinators and team administrators who manage time sensitive broadcasts across Nigeria and West Africa. Users frequently switch between office workstations and mobile phones at event venues, often in bright outdoor light or on intermittent network connections. Before this decision, the application had disparate styling patterns, legacy church specific naming, and inconsistent button shapes across routes.

Without a unified design system, new features risk creating conflicting visual patterns, broken dark mode states, and inaccessible forms. Developers would repeatedly rewrite navigation bars, card wrappers, and channel indicators. We need a cohesive, resilient component baseline that reinforces operator confidence and speeds up feature delivery.

## Options considered

### Option 1: Base UI primitives with Tailwind CSS v4 and stadium curvature

Build upon `@base-ui/react` primitives styled with Tailwind CSS v4 custom theme tokens, featuring 26px stadium radius cards, pill buttons, and hairline perimeter rings.

**Pros**:
- Lightweight unstyled accessible foundation with minimal DOM overhead.
- Directly aligns with existing implementation in `src/components/ui/` and `DESIGN.md`.
- Provides flexible styling without fighting rigid prepackaged component CSS.

**Cons**:
- Requires maintaining our own variant styles and animation glue.

### Option 2: Radix UI primitives with standard Shadcn styling

Adopt the standard Radix UI component library with conventional 6px to 8px box radius defaults.

**Pros**:
- Widely adopted ecosystem with plentiful copy and paste community recipes.

**Cons**:
- Fights the custom tactile stadium silhouette already established in the codebase.
- Replaces working Base UI components with unnecessary churn.

### Option 3: Pure HTML elements with utility classes only

Avoid primitive libraries entirely, writing plain HTML elements with Tailwind classes and manual ARIA management.

**Pros**:
- Zero additional npm dependencies.

**Cons**:
- High risk of accessibility defects in complex components like dialogs, popovers, and animated tab lists.
- Significant boilerplate for keyboard focus traps and portal management.

## Rationale

Base UI provides robust unstyled accessible behavior with first class React 19 support, avoiding the friction of opinionated CSS resets. The incumbent codebase already demonstrates high aesthetic quality using Base UI for buttons, dialogs, tabs, and inputs. Standardizing this foundation fulfills the design contract recorded in `DESIGN.md` while eliminating component drift across features.

The top bar with animated sticky tabs provides fast desktop navigation without sacrificing horizontal workspace for dense tables. On mobile screens, folding the navigation into a clean accordion drawer guarantees high density scanability while keeping critical broadcast actions within reach.
