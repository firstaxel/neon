# Review, branch, 2026-09-13

**Reviewed by**: pro (author on gemini 3.8 flash)
**Scope**: 13 files, branch vs base
**Verdict**: Approve (All findings resolved and verified)

## Summary
The implementation successfully integrates the Gemini AI vision API for contact sheet parsing via Inngest and Cloudflare R2. The review interface correctly stages candidates and handles user validation prior to directory persistence. However, the database commit procedure suffers from an N+1 performance issue during batch inserts, and critical server procedures lack the required Sentry instrumentation.

## Major
### 🟠 N+1 Query in transaction loop, `src/features/upload/router/index.ts:405`
**Problem**: The `commitParsedJob` procedure iterates over `activeContacts` and performs sequential `tx.contact.findUnique`, `tx.contact.update`, or `tx.contact.create` calls inside a loop.
**Why it matters**: For large contact lists (e.g., hundreds of contacts from a sign-in sheet), this causes severe N+1 query performance degradation and keeps the database transaction open much longer than necessary, risking connection pool exhaustion.
**Suggested fix**: Pre-fetch all existing contacts matching the active phone numbers using a single `tx.contact.findMany({ where: { phone: { in: activePhones } } })`, map them in memory, and then perform the necessary creations and updates (ideally via bulk operations or at least avoiding the sequential read).

## Minor
### 🟡 Missing Sentry instrumentation, `src/features/upload/router/index.ts:332`
**Problem**: The `commitParsedJob` and `confirmDirectUpload` server procedures are not wrapped with `Sentry.startSpan`.
**Why it matters**: Project conventions (`AGENTS.md`) require instrumenting critical server functions. Without spans, tracking the performance and error traces of these complex batch operations will be difficult.
**Suggested fix**: Wrap the core logic of these procedures in `Sentry.startSpan`.

### 🟡 Swallowed error during presigned URL generation, `src/features/upload/router/index.ts:300`
**Problem**: The `try/catch` around `getPresignedDownloadUrl` silently swallows the error and falls back to an empty string.
**Why it matters**: If R2 credentials are misconfigured or expire, the image URL will silently fail to load on the frontend without any backend logs indicating why.
**Suggested fix**: Log the error (e.g., `console.error`) before defaulting to an empty string so it is visible in the server logs.

## Strengths
- Excellent use of idempotency in `confirmDirectUpload` by using `upsert` and checking `inngestEventId`.
- Good separation of concerns by utilizing an Inngest background job to avoid blocking the main API thread during the slow Gemini API call.

## Test coverage
The changes appear to introduce test files (`roster-review.test.tsx` and `upload/router/index.test.ts`), which satisfies the configured test signal. However, ensure that the various import strategies (`skip_duplicates`, `overwrite`, `tags_only`) within the transaction are fully exercised by these tests.

## Resolution (All Findings Fixed and Verified)

All findings identified during the review were addressed immediately and verified:
1. **Major fixed**: `commitParsedJob` extracts phone normalization and batch prefetches matching contacts in a single `tx.contact.findMany({ where: { phone: { in: activePhones }, uploadedBy: userId } })` query. Updates and creations maintain an in memory contact lookup map, eliminating the N+1 read pattern and handling in batch duplicates without redundant queries. Dedicated regression test added in `src/features/upload/router/index.test.ts`.
2. **Minor 1 fixed**: Wrapped `uploadContactImage`, `confirmDirectUpload`, and `commitParsedJob` with `startSpan` from `@sentry/tanstackstart-react` conforming to `AGENTS.md` rules.
3. **Minor 2 fixed**: In `getParseJob`, caught errors from `getPresignedDownloadUrl` now call `captureException(error)` and log the failure using `console.error` with contextual information before falling back to an empty string.
4. **Cognitive complexity refactor**: Extracted `resolveContactMutation` and `executeBatchCommit` helper functions, satisfying Ultracite strict cognitive complexity limits with 0 diagnostics.
5. **Verification**: All 28 test files and 172 tests pass cleanly. `bun x tsc --noEmit` and Ultracite Biome checks clean with zero errors.

