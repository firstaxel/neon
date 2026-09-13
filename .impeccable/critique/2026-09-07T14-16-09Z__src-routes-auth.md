---
target: src/(auth)/*
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:/home/codeheart/Documents/source/neon/src/routes/(auth)"
timestamp: 2026-09-07T14-16-09Z
slug: src-routes-auth
---
Method: dual-agent (A: 5563de4b-1b00-494b-9d73-3bcb0bc77d94 · B: 3d6bb4ca-7da1-49f4-9305-46f8016cf21c)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:-----:|-----------|
| 1 | Visibility of System Status | 2 | `PasswordForm` in `login-view.tsx` toasts an error on failed auth but still triggers `navigate()` to `/dashboard`. Google OAuth callback in `register-view.tsx` contains an unescaped `\t` character. |
| 2 | Match Between System and Real World | 2 | Generic SaaS copy throughout; zero mention of faith organizations, NGOs, schools, or attendance rosters. Jargon like "magic link" is unexplained. |
| 3 | User Control and Freedom | 2 | Mode switching wipes user inputs. No resend button on forgot password screen. Legal links dump users on marketing root `/`. |
| 4 | Consistency and Standards | 1 | Design system tokens ignored: all inputs/buttons hardcode `rounded-xl`, overriding `DESIGN.md` stadium curves (`rounded-3xl` inputs, `rounded-4xl` buttons). "Forgot password?" is rendered twice in login. |
| 5 | Error Prevention | 1 | Default registration flow is Magic Link, but backend disables sign-ups via magic link (`disableSignUp: true` in `auth.ts`), guaranteeing 100% failure for new signups. `autoFocus` targets password instead of email. |
| 6 | Recognition Rather Than Recall | 2 | Inputs rely entirely on vanishing `placeholder` attributes with no persistent `<FieldLabel>`. Once filled, field purpose is hidden. |
| 7 | Flexibility and Efficiency of Use | 2 | Tab ordering broken by misplaced `autoFocus`. No password visibility toggle on login or registration forms. No remember-me option. |
| 8 | Aesthetic and Minimalist Design | 2 | Nested card padding (`px-6` on Card + `px-6` on CardContent) chokes form width to 288px on mobile. Duplicate "Forgot password?" links create clutter. |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | 1 | `register-view.tsx` completely omits `<field.Error />` from all inputs. Form errors render as a detached raw string. |
| 10 | Help and Documentation | 1 | No delivery expectation for verification emails, no contextual support/help access, and no guidance for network latency. |
| **Total** | | **16/40** | **Poor (12–19: Major UX overhaul required; core experience broken)** |

---

## Design Specificity Verdict

### Verdict: Category-Interchangeable SaaS Boilerplate (Severe Brand & System Drift)

**LLM Assessment**:
The authentication experience is completely disconnected from Velocast's product identity, mission, and regional operational realities:
- **Total Brand Absence**: The name **"Velocast" does not appear anywhere** across all auth screens. The logo is a generic placeholder asterisk SVG (`<title>Logo</title>`) copied into multiple views.
- **Design Token Inversion**: `DESIGN.md` mandates **The Tactile Dispatch Console** aesthetic—hyper-rounded stadium curves (`rounded-4xl` cards and buttons, `rounded-3xl` inputs) and hairline perimeter rings (`ring-1 ring-foreground/5`). Every button and input in the auth folder actively overrides these design tokens with `rounded-xl`, flattening the distinct stadium silhouette into generic squircle shapes.
- **Signal Color Purity Breach**: `user-avatar.tsx` assigns WhatsApp Emerald (`#25d366`) and Telecom Blue (`#60a5fa`) as random user avatar colors, violating **The Signal Purity Rule** (`DESIGN.md:L139`), and introduces an unauthorized font (`Space Grotesk`).
- **Operating Context Mismatch**: For Nigerian/West African administrators on mobile networks, defaulting to email magic links introduces high latency and deliverability friction. Worse, magic link registration is disabled on the backend, making the default registration flow a complete dead end.

**Deterministic Scan**:
- **0 Blocking Errors**, **1 Advisory Finding** (Exit code `0`).
- [`src/features/auth/components/user-avatar.tsx:95`](file:///home/codeheart/Documents/source/neon/src/features/auth/components/user-avatar.tsx#L95): `design-system-color` violation for hardcoded `#080c14` (unmapped dark tone used as a 2px cutout border around the online status indicator, which clashes with light theme surfaces).
- The scan verified acceptable exemptions for standard Google brand SVG paths (`#4285F4`, `#34A853`, etc.) in `login-view.tsx` and `register-view.tsx`.

**Visual Overlays**:
- Skipped. Native browser automation and DOM script injection are not available in this environment. Static AST analysis and code verification served as the fallback signal.

---

## Overall Impression

Velocast's authentication surface is an uncustomized starter-kit island inside a bespoke product. While the underlying primitives (`Card`, `Input`, `Button`) and route schemas are well-architected, the screens violate their own design tokens, omit the brand identity, suffer from fatal registration misconfigurations, and create disorientation through navigation bugs and missing labels.

---

## What's Working

1. **Robust Route Structure & Deep-Link Query Validation**:
   - `src/routes/(auth)/login/index.tsx` and `register/index.tsx` use Zod route schemas to validate `callbackURL`, safely preserving deep-link destinations across login and signup.
2. **Accessible Password Visibility Toggle on Reset View**:
   - `reset-password-view.tsx` provides an accessible eye icon toggle with clear SVG paths, `<title>` elements, and proper `type="password"` / `type="text"` switching.
3. **Graceful Token Fallback Card**:
   - `reset-password-view.tsx` handles missing or invalid `?token=` parameters cleanly, displaying a dedicated "Invalid link" state with a recovery action instead of an unhandled crash.

---

## Priority Issues

### [P0] Fatal Configuration Conflict: Default Magic Link Registration Fails 100% of Signups
- **What**: In `src/features/auth/components/register-view.tsx:L66-198`, `MagicLinkRegisterForm` is the active default view. However, `src/lib/auth.ts:L59` has `magicLink({ disableSignUp: true })`. Submitting the default form triggers an unhandled error ("Failed to send link").
- **Why it matters**: Zero new users can sign up using the default form. This is an absolute blocker for user acquisition.
- **Fix**: Make `PasswordRegisterForm` the default and primary registration method; remove or gate magic link signup.
- **Suggested command**: `$impeccable harden src/features/auth/components/register-view.tsx`

---

### [P1] Critical Navigation Bug on Failed Login & Corrupted OAuth Callback
- **What**:
  1. In `src/features/auth/components/login-view.tsx:L170-174`, `PasswordForm.onSubmit` toasts an error on invalid credentials but forgets to return early, proceeding to execute `navigate({ to: callbackURL ?? "/dashboard" })`.
  2. In `src/features/auth/components/register-view.tsx:L402`, the Google OAuth callback string contains an unescaped literal tab character: `callbackURL: callbackURL ?? "/dashboard\t"`.
- **Why it matters**: Users entering bad credentials are disorientingly pushed to the protected dashboard before being bounced. Google registrations initiate OAuth with a corrupted redirect URL.
- **Fix**: Add an early `return` after `toast.error()` in `PasswordForm`. Strip `\t` from `register-view.tsx`.
- **Suggested command**: `$impeccable harden src/features/auth/components/login-view.tsx`

---

### [P2] Pervasive Design System Token Breaches & Missing Brand Identity
- **What**:
  1. The word "Velocast" is nowhere on screen; a generic asterisk `<Logo />` is duplicated across views.
  2. Every input and button explicitly passes `rounded-xl`, overriding `rounded-3xl` input and `rounded-4xl` button tokens from `DESIGN.md`.
  3. `user-avatar.tsx` uses inline styles, unapproved `'Space Grotesk'` font, and violates **The Signal Purity Rule** by consuming semantic `#25d366` and `#60a5fa` colors.
- **Why it matters**: Degrades organizational confidence. Auth is the first impression for church and NGO leaders managing institutional funds and subscriber rosters.
- **Fix**: Mount the official Velocast logo and brand typography; strip all `rounded-xl` overrides to restore stadium curvature; refactor `user-avatar.tsx` with standard tokens.
- **Suggested command**: `$impeccable shape src/features/auth/components/login-view.tsx`

---

### [P3] Accessibility & Usability Failures: Missing Labels, No Field Errors, Misplaced AutoFocus
- **What**:
  1. Inputs lack `<FieldLabel>` or `<label>` elements, relying solely on vanishing placeholder text.
  2. `register-view.tsx` omits `<field.Error />` from all inputs, hiding validation errors.
  3. `autoFocus` is placed on the password input in `login-view.tsx` and `register-view.tsx`, disorienting mobile users.
  4. Login and register forms lack a password reveal toggle.
- **Why it matters**: Fails WCAG AA. Screen reader users get no persistent field names, and mobile users suffer high typo rates.
- **Fix**: Add `<FieldLabel>` to all inputs; restore `<field.Error />` in `register-view.tsx`; move focus to the first field; reuse the password reveal toggle from `reset-password-view.tsx`.
- **Suggested command**: `$impeccable clarify src/features/auth/components/register-view.tsx`

---

### [P3] Layout Compression & Choice Overload Clutter
- **What**:
  1. `src/routes/(auth)/route.tsx` provides no layout canvas or styling.
  2. Nested padding (`px-6` on Card + `px-6` on CardContent) chokes form width to 288px on mobile.
  3. `login-view.tsx` renders 10 competing interactive options simultaneously, including duplicate "Forgot password?" links.
- **Why it matters**: Severe cognitive overload and cramped visual rhythm on mobile devices.
- **Fix**: Style the auth layout in `route.tsx`; fix double-padding; remove duplicate links; consolidate login methods into clear tabs.
- **Suggested command**: `$impeccable distill src/features/auth/components/login-view.tsx`

---

## Persona Red Flags

### 1. Jordan (Confused First-Timer)
*Faith or NGO administrator setting up Velocast for their organization.*
- **Action**: Navigates to `/register` to create an account for their church.
- **Red Flags**:
  - Sees an unnamed geometric asterisk and no mention of Velocast or organizational messaging (`register-view.tsx:L15-36`).
  - Enters name and email in the default form, clicks "Send me the magic link", and hits a fatal runtime error: `"Failed to send link"` (`register-view.tsx:L78`) due to `disableSignUp: true` in `auth.ts`.
  - Confused by unexplained "magic link" jargon.
  - Clicks "Terms of Service" to verify data privacy, but is thrown to `/` (`register-view.tsx:L446`), losing all entered form state.
  - **Outcome**: Immediate abandonment before ever entering the application.

### 2. Casey (Distracted Mobile User)
*Admin signing in on a smartphone on-site at a Sunday service or event desk.*
- **Action**: Logs into Velocast to verify campaign wallet balance and trigger roster parsing.
- **Red Flags**:
  - Double horizontal card padding squeezes form elements to 288px width.
  - Tapping "Sign in using password" triggers `autoFocus` on the **password field** (`login-view.tsx:L246`), prematurely opening the mobile keyboard and occluding the email field.
  - No reveal toggle on the password field to verify typos.
  - Submitting with invalid credentials toasts an error but simultaneously triggers a redirect to `/dashboard` (`login-view.tsx:L173`), causing disorienting UI flicker.
  - **Outcome**: Severe frustration and input errors under time pressure.

### 3. Sam (Accessibility-Dependent User)
*Coordinator navigating using a screen reader (NVDA / VoiceOver) and keyboard.*
- **Action**: Tabbing through the registration form and correcting invalid inputs.
- **Red Flags**:
  - Inputs lack `<FieldLabel>` or `<label>` elements; once characters are entered, screen readers announce only the value without context.
  - In `login-view.tsx:L233`, the password label is an unassociated `<span className="...">` rather than an accessible label.
  - In `register-view.tsx`, all fields lack `<field.Error />`; validation errors triggered on blur are never read by assistive software.
  - In `user-avatar.tsx:L9-15`, `initials("")` on empty names returns an empty string without an accessible fallback.
  - **Outcome**: Critical accessibility failure; unable to independently register.

---

## Minor Observations

1. **Bare Layout Shell**: `src/routes/(auth)/route.tsx` is completely unstyled (`<main className="container mx-auto"><Outlet /></main>`), lacking a centered background canvas, footer with help links, or brand frame.
2. **Hardcoded Expiration Strings**: `"It expires in 15 minutes"` is duplicated as hardcoded text across `login-view.tsx:L89`, `register-view.tsx:L99`, and `forgot-password-view.tsx:L88`.
3. **No Uncaught Error Boundary on Forgot Password**: `forgot-password-view.tsx:L48-57` lacks a try/catch block around `authClient.requestPasswordReset`, leaving network outages unhandled.
4. **Missing Organization Adaptive Tone**: Velocast includes an organization taxonomy system in `src/features/miscellaneous/org.ts` (Churches, NGOs, Schools, SMEs), but none of this warmth or personalization is introduced during signup.

---

## Questions to Consider

1. *What if phone number and WhatsApp OTP were the primary authentication mechanism instead of email magic links, immediately demonstrating Velocast's core messaging value on the user's very first interaction?*
2. *What if registration invited the administrator to select their organization type upfront (Church, NGO, School, SME) so the auth shell dynamically adapted its tone, imagery, and copy to their real-world mission?*
3. *What if the auth layout embraced Velocast's "Tactile Dispatch Console" aesthetic with an authentic high-contrast frame, live telecom status indicator, and stadium curvature instead of an anonymous floating modal?*
