# 0003. Authentication and Onboarding Flow

**Date**: 2026-09-08
**Status**: In Progress

## Summary

This specification establishes the complete authentication and onboarding flow for Velocast using Better Auth and TanStack Start. Users can register with email and password, sign in via Google OAuth or magic links, verify their email address, and complete a multi step organization setup wizard before reaching the main dashboard. Private application routes are guarded by edge safe server middleware that verifies signed session cookies without database overhead. Completing onboarding initializes the organization profile, establishes a prepaid wallet record, and seeds starter message templates tailored to the organization type within an atomic database transaction.

## Context

Velocast is a multi channel broadcast platform that sends high volume SMS and WhatsApp messages for organizations across Nigeria. Handling broadcast communications requires trusted sender identities, verified accounts, and clear organization metadata to prevent platform abuse and maintain telecommunications compliance. Without a unified authentication and onboarding mechanism, incoming users cannot establish sender reputations, configure default sender identities, or fund their prepaid wallets safely.

The technical environment combines TanStack Start on Bun with Nitro and Vite, Prisma ORM with PostgreSQL, and oRPC procedure routers. We need an authentication system that integrates cleanly with TanStack Start cookie management, supports edge compatible session verification, and offers low friction login methods including Google OAuth and passwordless magic links.

Enforcing verification before granting dashboard access protects sender reputation, prevents disposable spam accounts, and ensures Nigerian Communications Commission compliance for alphanumeric SMS sender registration. The onboarding experience must capture core organization details and sender preferences smoothly while keeping wallet top up optional so users can explore the console immediately after setup.

## Requirements

**User stories**:
- As an organization administrator, I want to create an account with email and password or Google OAuth and verify my email address so that my sending identity remains secure and trusted.
- As a newly registered user, I want a guided onboarding wizard to configure my organization details and preferred sender ID so that my messages display proper brand attributes.
- As a returning customer, I want to log in smoothly with session persistence, password reset recovery, or magic links so that I can reach my broadcast workspace without friction.
- As an unauthenticated visitor, I want protected routes to redirect me to the login page and return me to my intended page after successful sign in.

**Acceptance criteria**:
- **AC-1**: User registration via email and password creates an unverified user record, hashes credentials securely, and dispatches a verification email with a signed link.
- **AC-2**: Email verification callback validates the signed token, sets `emailVerified` to true, issues a signed session cookie, and redirects into the onboarding wizard.
- **AC-3**: Social registration and sign in via Google OAuth links to existing accounts when emails match and redirects new users to onboarding or returning users to the dashboard.
- **AC-4**: Magic link sign in sends a timed link to existing accounts and establishes a valid session without requiring a password.
- **AC-5**: Password reset flow generates a timed reset token, sends an email with reset instructions, and securely updates the user password hash upon submission.
- **AC-6**: Server side `authMiddleware` checks signed session cookies with zero database queries on protected routes, redirecting unauthenticated requests to `/login` with `callbackURL` preserved.
- **AC-7**: Authenticated users visiting public auth paths such as `/login`, `/register`, or `/forgot-password` are automatically redirected to the dashboard or safe `callbackURL`.
- **AC-8**: Client side `useOnboardingGuard` inspects `profile.onboardingComplete` and redirects uncompleted profiles to `/onboarding`, resuming at the recorded `onboardingStep`.
- **AC-9**: Multi step onboarding wizard captures organization attributes (name, type, size, role defaulting to admin, phone) and SMS sender ID selection, tolerating external API delays.
- **AC-10**: Onboarding completion atomically sets `onboardingComplete` to true, establishes an initial zero balance `Wallet` record, and seeds starter `MessageTemplate` records in a single transaction.
- **AC-11**: Better Auth rate limiting throttles authentication endpoints to 20 attempts per 60 seconds per IP, reading `x-forwarded-for` behind proxies and returning HTTP 429 when exceeded.

## Options considered

### Option 1: Better Auth with signed session cookies and TanStack Start middleware

Use Better Auth with its Prisma adapter, signed cookie caching via `tanstackStartCookies`, and a lightweight TanStack Start server middleware. The middleware inspects cookie signatures at the edge with zero database round trips, while full user records are loaded on demand inside protected route loaders or oRPC procedures.

**Pros**:
- Full ownership of user data inside PostgreSQL with Prisma ORM relations.
- Zero database latency on every protected route check through cryptographically signed cookies.
- Built in support for email verification, magic links, Google OAuth, password reset, and rate limiting.
- Seamless integration with TanStack Start cookie headers and reactive client hooks.

**Cons**:
- The application server remains responsible for email delivery infrastructure and SMTP configuration.

### Option 2: Third party hosted authentication service (such as Clerk or Auth0)

Delegate user management, authentication UI, and session token issuance entirely to an external SaaS provider.

**Pros**:
- Offloads email delivery, token signing, and security maintenance to an external vendor.
- Ready made hosted login widgets.

**Cons**:
- Introduces external network latency and vendor lock in for core identity workflows.
- Requires webhook synchronization to replicate user records into PostgreSQL for foreign key relationships.
- Substantially higher operating costs as active user counts expand.

### Option 3: Custom JWT tokens stored in browser local storage

Implement custom registration and login endpoints generating stateless JSON Web Tokens stored in browser local storage, validated via custom router hooks.

**Pros**:
- Total flexibility over custom token claims and endpoint behavior.

**Cons**:
- Vulnerable to cross site scripting token theft compared to HTTP only cookies.
- Requires building and maintaining refresh token rotation, revocation lists, and rate limiters from scratch.
- Incompatible with server side rendering and edge route guards before page render.

## Decision

**Chosen option**: Option 1: Better Auth with signed session cookies and TanStack Start middleware

We adopt Better Auth configured with the Prisma adapter, signed session cookies via `tanstackStartCookies`, and a two layer route guard combining server middleware and client onboarding redirection.

**Implementation skills**: `tanstack-start` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-start/`) · `tanstack-router` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-router/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `orpc` (`.agents/skills/orpc/`)

## Rationale

Better Auth provides a battle tested authentication engine directly embedded within our Bun runtime and PostgreSQL database. Using signed session cookies gives us edge safe route protection with zero database calls on ordinary page navigation, fulfilling our need for fast response times.

Keeping identity in our primary PostgreSQL database preserves foreign key integrity for wallets, contacts, campaigns, and delivery logs. External services like Clerk or Auth0 would add webhook synchronization lag and unnecessary monthly fees. Hand rolling custom JWT authentication carries severe security hazards regarding token theft and session revocation. Better Auth gives us email verification, Google OAuth, magic link fallback, and rate limiting in a coherent package that fits our existing Prisma schema.

## Feature design

**Data model sketch**:

```
User (id [PK], email [unique], name, emailVerified, image, createdAt, updatedAt)
  |-- 1:1 --> UserProfile (id [PK], userId [FK, unique], orgName, orgType, orgSize, role, phone, senderId, usePlatformSender, onboardingComplete, onboardingStep, timezone, createdAt, updatedAt)
  |-- 1:1 --> Wallet (id [PK], userId [FK, unique], balanceKobo, heldKobo, createdAt, updatedAt)
  |-- 1:N --> Session (id [PK], userId [FK], token [unique], expiresAt, ipAddress, userAgent, createdAt, updatedAt)
  |-- 1:N --> Account (id [PK], userId [FK], providerId, accountId, password, accessToken, refreshToken, scope, createdAt, updatedAt)
  |-- 1:N --> SenderNumber (id [PK], userId [FK], number, label, channel, isActive, sentCount, createdAt, updatedAt)
  |-- 1:N --> MessageTemplate (id [PK], userId [FK], name, displayName, category, channel, bodyText, createdAt, updatedAt)

Verification (id [PK], identifier [index], value, expiresAt, createdAt, updatedAt)
```

**State transitions**:

User account lifecycle:
1. `Unregistered`: Visitor provides email and password or clicks Google OAuth.
2. `Registered (Unverified)`: User row created with `emailVerified = false`. Access to dashboard is blocked.
3. `Verified`: Email link clicked or Google OAuth succeeds. `emailVerified = true`. Session cookie issued.
4. `Onboarding`: User guided through organization setup wizard (`onboardingComplete = false`), resuming from `onboardingStep`.
5. `Active Member`: Wizard completed. Atomic transaction sets `onboardingComplete = true`, initializes `Wallet`, seeds `MessageTemplate` records, and unlocks dashboard access.

**API surface**:

| Endpoint or Procedure | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/auth/sign-up/email | POST | email:string, password:string, name:string | user object, status | Public | 400 invalid, 409 email taken, 429 rate limit |
| /api/auth/sign-in/email | POST | email:string, password:string | session cookie, user | Public | 401 invalid credentials, 403 unverified, 429 rate limit |
| /api/auth/sign-in/social | POST | provider:string, callbackURL:string | redirect URL | Public | 400 provider unsupported |
| /api/auth/sign-in/magic-link | POST | email:string | success:boolean | Public | 404 not found, 429 rate limit |
| /api/auth/verify-email | GET | token:string, callbackURL:string | redirect to /onboarding | Public | 400 token expired or invalid |
| /api/auth/send-verification-email | POST | email:string | success:boolean | Public | 429 rate limit |
| /api/auth/forget-password | POST | email:string | success:boolean | Public | 429 rate limit |
| /api/auth/reset-password | POST | token:string, newPassword:string | success:boolean | Public | 400 invalid or expired token |
| /api/auth/sign-out | POST | none | session cleared | Authenticated | 401 unauthorized |
| profile.get | Query | none | user and profile record | Authenticated | 401 unauthorized |
| profile.completeOnboarding | Mutation | orgName, orgType, orgSize, role, phone, smsSenderId, usePlatformSender, timezone, step, complete | profile record, success | Authenticated | 400 invalid input, 401 unauthorized |
| profile.submitSenderId | Mutation | senderId:string, label:string | dbId, submitted, success | Authenticated | 400 invalid format, 401 unauthorized |
| profile.updatePassword | Mutation | currentPassword:string, newPassword:string | success:boolean | Authenticated | 400 wrong password, 401 unauthorized |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| User sign up | User record, verification token | Form inputs (email, password, name) |
| Email verification | `emailVerified` = true | Cryptographic token in email verification URL |
| Resend verification | Dispatched email with fresh token | Inline action button on unverified notice |
| Edge session check | `isAuthenticated`, `sessionCookie` | Better Auth signed cookie in incoming HTTP request header |
| Timezone selection | `timezone` identifier string | Client browser auto detection via Intl API with Africa/Lagos fallback |
| Initial role assignment | `role` enum value (`admin`) | Default assigned to account creator upon completing onboarding |
| Profile onboarding step | `orgName`, `orgType`, `orgSize`, `phone` | Step 1 wizard form inputs |
| Sender ID registration | `senderId`, `usePlatformSender` | Step 2 wizard form inputs, validated alphanumeric string |
| Sender ID approval state | `isActive` boolean flag (initially false) | Termii API response status and telecommunications review cycle |
| Wallet initialization | `balanceKobo` = 0, `heldKobo` = 0 | Database transaction defaults created during onboarding finalization |
| Scenario templates | Initial `MessageTemplate` records | System template library seeded based on selected `orgType` in transaction |
| Safe login redirect | Post login navigation URL | `callbackURL` query parameter validated against safe origin rules |

**Key invariants**:
- User email address must be unique across the entire database.
- Sessions and accounts cascade delete when the parent User record is removed.
- Dashboard routes reject any request lacking a valid signed session cookie.
- Users with `onboardingComplete = false` are automatically redirected to `/onboarding`.
- Navigating back to `/onboarding` resumes directly from the saved `profile.onboardingStep`.
- Onboarding finalization (`onboardingComplete = true`, `Wallet` creation, template seeding) must execute within a single atomic database transaction.
- Sender numbers configured during onboarding are saved with `isActive = false` pending telecommunications approval, with clear pending UI status on the dashboard.
- Termii submission failures or timeouts during onboarding must be caught gracefully and logged, saving the record locally without aborting onboarding.
- SMS sender IDs must be alphanumeric and between 3 and 11 characters long.
- Password hashes must never be exposed over API responses or client contexts.
- Rate limiting must read `x-forwarded-for` headers to enforce per IP limits accurately when behind reverse proxies.

**Security model**:
- Route protection: `authMiddleware` intercepts all requests outside bypass prefixes and public paths. Unauthenticated requests receive HTTP 302 redirects to `/login?callbackURL=`.
- Cookies: HTTP only, Secure in production, SameSite Lax, with custom cookie prefix `Velocast`.
- Passwords: Minimum 8 characters, maximum 128 characters, hashed using Better Auth standard scrypt password hashing.
- Role authorization: Organization roles include `admin`, `leader`, `manager`, `staff`, `volunteer`, and `coordinator`. Account owners hold administrative access over their workspace data.
- Rate limiting: 20 requests per 60 second window for public authentication routes to prevent credential stuffing and brute force attacks.

**Configuration required**:
- `BETTER_AUTH_URL`: Canonical public URL of the application for callback generation.
- `BETTER_AUTH_SECRET`: Cryptographic secret key used to sign session cookies and tokens.
- `GOOGLE_CLIENT_ID`: OAuth client identifier from Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: OAuth client secret from Google Cloud Console.
- `SMTP_HOST`: SMTP server hostname for outbound verification and reset emails.
- `SMTP_PORT`: SMTP port (587 for STARTTLS or 465 for SSL).
- `SMTP_USER`: SMTP username or authenticated sending account.
- `SMTP_PASS`: SMTP password or application credential.
- `EMAIL_FROM`: Outbound sender header (e.g. `Velocast <no-reply@velocast.ng>`).
- `TERMII_API_KEY`: API credential used to submit alphanumeric SMS sender IDs for telecommunications approval.

**Critical test scenarios**:
- Happy path: User registers with email and password, receives verification link, verifies email, completes the onboarding wizard, and lands on the dashboard with seeded templates and wallet ready, verifies **AC-1**, **AC-2**, **AC-9**, **AC-10**.
- Social authentication: User signs in using Google OAuth, bypasses password setup, automatically completes email verification, and reaches onboarding, verifies **AC-3**.
- Password reset and recovery: User requests password reset, receives timed token link, submits new password, and logs in successfully with new credentials, verifies **AC-5**.
- Unauthenticated access prevention: Direct browser navigation to `/dashboard` or `/contacts` without a session cookie triggers a server 302 redirect to `/login?callbackURL=/dashboard`, verifies **AC-6**.
- Onboarding enforcement and resumption: Authenticated user with `onboardingComplete = false` attempting to access `/dashboard` is redirected to `/onboarding` and resumes at the saved step, verifies **AC-8**.
- Atomic finalization: Simulating a database failure during template seeding aborts the entire transaction, preventing a partially completed onboarding state, verifies **AC-10**.
- Abuse prevention: Client submitting more than 20 authentication requests within 60 seconds receives HTTP 429, verifies **AC-11**.

## Build plan

Following our Tracer Bullet build approach, tasks are ordered to stand up the thin end to end thread through registration, verification, session issuance, and route gating before thickening the onboarding wizard and profile management.

1. [x] Wire and verify end to end authentication loop: user registration, email verification token issuance, and login session cookie creation, satisfies **AC-1**, **AC-2**
2. [x] Enforce edge session verification in `authMiddleware` with safe redirection to `/login?callbackURL=` and authenticated bypass, satisfies **AC-6**, **AC-7**
3. [x] Enable social sign in via Google OAuth and passwordless magic links with account linking, satisfies **AC-3**, **AC-4**
4. [x] Implement password reset flow with timed tokens and React Email notification, satisfies **AC-5**
5. [x] Connect client side onboarding guard and route layout integration with step resumption, satisfies **AC-8**
6. [x] Polish multi step onboarding wizard storing organization profile attributes and sender ID selection with resilient Termii submission error handling, satisfies **AC-9**
7. [x] Finalize onboarding completion procedure to execute an atomic database transaction that initializes wallet record, seeds organization templates, and unlocks the dashboard, satisfies **AC-10**
8. [x] Verify rate limiting reading proxy headers and error handling for auth endpoints with inline UI feedback, satisfies **AC-11**

## Consequences

**Positive**:
- Edge safe session checking guarantees sub millisecond authentication checks on protected pages without database load.
- Better Auth consolidation provides email, social, magic link, and password reset flows within a single unified client.
- Strict email verification protects sender reputation and prevents disposable spam registrations.
- Guided onboarding ensures every active user has an organization profile, default sender preference, and seeded templates.
- Atomic finalization prevents orphaned user records with incomplete onboarding states.

**Negative / tradeoffs**:
- Mandatory email verification introduces an extra friction step before users can view the dashboard.
- In memory rate limiting resets on server restart; multi instance deployments will eventually require shared Redis storage if scaled horizontally.

**Neutral**:
- New developers must configure local SMTP credentials or use the development Ethereal email catch all to test registration links.
- Session cookie cache of 5 minutes means immediate role changes take up to 5 minutes to reflect unless explicit cookie invalidation is called.

## Follow-up

- [ ] Create `src/auth/AGENTS.md` to document authentication conventions, cookie configurations, and security patterns in an isolated context file rather than overloading root `AGENTS.md`.
