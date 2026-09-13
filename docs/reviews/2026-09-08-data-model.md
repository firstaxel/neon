# Review, current branch, 2026-09-08

**Reviewed by**: Gemini 2.5 Pro (independent review subagent) (author on Gemini 2.5 Pro)
**Scope**: 51 files, branch vs base
**Verdict**: Changes requested

## Summary
This change cleanly establishes the Better Auth session flows, edge-safe middleware route protection, and consolidates the organization onboarding process into a multi-step wizard. The transaction logic for initializing workspaces securely is a major step forward. However, there are significant omissions around submitting custom Sender IDs to the Termii API during onboarding, and missing proxy configurations for the rate limiter that could lead to global lockouts.

## Major
### 🟠 Missing Termii API submission during onboarding, `src/features/profile/server/router.ts:160`
**Problem**: The `completeOnboarding` procedure accepts and saves a custom `smsSenderId` to the local database, but it never actually submits the ID to the Termii API for telecommunications approval.
**Why it matters**: AC-9 explicitly states that the wizard must capture and submit the sender ID selection while tolerating API delays. Without the API submission here, custom sender IDs collected during onboarding will remain perpetually stuck in an inactive state and never be reviewed by the provider.
**Suggested fix**: Extract the Termii submission logic found in the `submitSenderId` procedure into a shared utility function, and invoke it securely within (or safely immediately after) the `completeOnboarding` routine. Ensure the implementation catches and tolerates network timeouts gracefully.

### 🟠 Rate limiting proxy configuration missing, `src/lib/auth.ts:20`
**Problem**: Better Auth's rate limiter is enabled on line 74, but the `advanced` configuration block lacks `trustHost: true` or `useForwardedHeaders: true`.
**Why it matters**: AC-11 requires reading the `x-forwarded-for` header behind proxies. Without explicitly configuring Better Auth to trust forwarded headers, it will mistakenly identify all incoming requests using the reverse proxy's internal IP address. This causes the 20 requests per 60 seconds limit to apply globally across all users, which acts as an accidental denial of service against the authentication endpoints.
**Suggested fix**: Add `trustHost: true` to the `advanced` configuration block to instruct Better Auth to properly parse `X-Forwarded-For` proxy headers.

### 🟠 Missing test coverage for onboarding completion, `src/features/profile/server/router.ts:124`
**Problem**: The `completeOnboarding` mutation, including the newly added atomic `$transaction` containing wallet initialization and template seeding, has no corresponding test in the test suite.
**Why it matters**: `TESTS = configured` on this project, and the review guide dictates that new branching or security-relevant logic lacking a test is a Major finding. This transaction governs the crucial state transition from new sign-up to active workspace member and needs a safety net.
**Suggested fix**: Create a `router.test.ts` for the profile feature that verifies `completeOnboarding` correctly updates profiles, initializes the zero-balance wallet, seeds the templates, and aborts cleanly if an inner database operation fails.

## Minor
### 🟡 Incorrect validation length check on uncleaned Sender ID, `src/features/profile/server/router.ts:160`
**Problem**: The minimum length check `smsSenderId.trim().length >= 3` is performed on the raw input string before non-alphanumeric characters are stripped on the following line.
**Why it matters**: A user could submit a string like `!@#4`, which passes the initial length check (length 4) but reduces to a single character `4` after `replace(/[^a-zA-Z0-9]/g, "")`. This creates a truncated Sender ID in the database that violates the NCC 3-character minimum rule.
**Suggested fix**: Clean the string first by stripping non-alphanumeric characters, and then validate that the length of the resulting `cleanId` is at least 3 characters.

## Nits
- ⚪ `src/features/profile/server/router.ts:204`, Type assertion `tx as unknown as PrismaClient` circumvents Prisma's `$transaction` types. Since Prisma transactions natively support the methods used by `seedScenarioTemplates`, consider typing its `db` parameter as `Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>`.

## Strengths
- The `authMiddleware` implementation is clean and properly applies zero-database-latency edge checks using signed session cookies.
- Wallet initialization and scenario templates are safely batched into a single Prisma `$transaction` during onboarding completion.
- The use of `Intl.DateTimeFormat().resolvedOptions().timeZone` seamlessly solves timezone detection without blocking the client side flow.

## Test coverage
The core `authMiddleware` and `profile.router.ts` (`completeOnboarding`) are entirely uncovered by the current tests (`src/test/setup.ts` additions provide environment variables, but test coverage for these flows doesn't exist yet). The test suite needs expansion to cover the critical edge checking and onboarding transactions introduced in this change.

## Resolution (2026-09-08)
- ✅ **Termii API submission added**: Custom sender IDs captured during onboarding are cleaned and submitted to `https://v3.api.termii.com/api/sender-id/request` via `submitSenderIdToTermii` immediately after transaction completion, catching network timeouts gracefully.
- ✅ **Rate limiting proxy configuration enabled**: Configured `trustHost: true` and `useForwardedHeaders: true` in Better Auth `advanced` options in `src/lib/auth.ts`.
- ✅ **Onboarding unit test suite implemented**: Created `src/features/profile/server/router.test.ts` covering atomic transaction execution, zero-balance wallet creation, template seeding, and error rollback. All 43 test assertions pass cleanly.
- ✅ **Validation cleaned string length check**: String sanitization now strips non-alphanumeric characters before enforcing the 3-character minimum length constraint.
- ✅ **Prisma transaction type safety**: `TemplateDbClient` interface created in `seed-scenario-templates.ts`, eliminating the `tx as unknown as PrismaClient` type assertion.
