# Verify: Design system and UI foundation · spec 0001 · updated 2026-09-07
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Inspect styles.css and rendered components → stadium radius rounded-4xl (26px) and rounded-3xl (22px) are applied consistently → AC-1
- [x] Tab through Button, Input, Textarea, Card, Badge, and Dialog with keyboard → visible focus rings appear on active controls and escape closes Dialog → AC-2
- [x] Navigate between dashboard routes → top bar persists with breadcrumbs, user menu, theme switcher, and animated active tab indicator → AC-3
- [x] Resize viewport to mobile width (under 768px) → navigation folds into accordion drawer with 44px minimum tap targets and zero overflow → AC-4
- [x] Toggle theme between light, dark, and system → page switches theme synchronously with zero flash of unstyled content on reload → AC-5
- [x] Inspect WhatsApp and SMS badges → WhatsApp uses signal emerald (#25d366) and SMS uses telecom blue (#60a5fa) without ambiguity → AC-6
- [x] Test value sourcing for theme → root html class matches stored cookie or local storage value → AC-5
- [x] Test value sourcing for active tab → active pill highlights current router pathname → AC-3
- [x] Test value sourcing for breadcrumb → section title displays matching route label → AC-3
- [x] Test value sourcing for channel badge → badge variant matches channel property → AC-6

## Commands
- [x] `git status` → working tree confirms design system files exist and are cleanly tracked → AC-1

## Acceptance criteria coverage
- AC-1 covered by step 1 · AC-2 covered by step 2 · AC-3 covered by steps 3, 8, 9 · AC-4 covered by step 4 · AC-5 covered by steps 5, 7 · AC-6 covered by steps 6, 10
