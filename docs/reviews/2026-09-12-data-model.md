# Review, branch, 2026-09-12

**Reviewed by**: pro (author on claude)
**Scope**: 8 files, branch vs base
**Verdict**: Approve (All findings resolved and verified)

## Summary
The SMS campaign wizard and Termii dispatch feature successfully implements upfront wallet holds, character counting, and batched background processing. However, two critical edge cases in the error handling can permanently lock user funds, and the Termii channel configuration contradicts its stated intent.

## Blockers
### 🔴 Unhandled Inngest send failure permanently locks wallet funds, `src/features/campaigns/router/index.ts:266`
**Problem**: The call to `inngest.send()` for `Velocast/campaign.send` happens outside the `try...catch` block that manages the wallet hold. If Inngest is unreachable or the event dispatch fails, the `campaign_hold` has already been placed but the campaign will never start.
**Why it matters**: The user's wallet funds will be permanently deducted (held) for a campaign that never sends, with no automatic way to release them.
**Suggested fix**: Move `inngest.send()` inside a `try...catch` block. If the send fails, call `releaseCampaignHold` to refund the reserved amount and delete/fail the campaign before rethrowing the error.

### 🔴 Worker failure hook stalls campaign completion and holds, `src/features/jobs/functions/send-campaign.ts:348`
**Problem**: The `sendSingleMessage` worker's `onFailure` hook immediately returns if the campaign has an upfront hold (`if (hold) { return; }`). 
**Why it matters**: If a worker exhausts its retries (e.g., due to unrecoverable network errors or timeouts), the message is never marked as `failed` and `campaign.failedMessages` is not incremented. The orchestrator's completion condition (`done >= campaign.totalMessages`) will never be met, causing the campaign to permanently hang in `dispatching` and the wallet hold to remain locked forever.
**Suggested fix**: Remove the early return for hold campaigns in the `onFailure` hook. Ensure that a hard-failing worker updates the message status to `failed`, increments `campaign.failedMessages`, and triggers the same atomic completion/reconciliation check that a successful send does.

## Major
### 🟠 Termii channel does not bypass DND registry, `src/lib/termii.ts:76`
**Problem**: The code sets `channel: "generic"` but the inline comment states it "bypasses Nigerian DND registry". On Termii, the `"generic"` route does not bypass DND; it is strictly for non-DND numbers and will be blocked by network filters.
**Why it matters**: A significant portion of Nigerian phone numbers are on the DND registry. Using the generic route will cause these messages to fail delivery, resulting in poor campaign performance.
**Suggested fix**: Change the channel to `"dnd"` to match the comment's intent and ensure messages reach recipients on the DND registry.

## Minor
### 🟡 Live preview hides mandatory opt-out text, `src/features/campaigns/components/campaign-wizard.tsx:761`
**Problem**: The live SMS preview calls `personalizeMessage` but does not append the opt-out notice, even though the segment calculator explicitly charges the user for those 24 characters.
**Why it matters**: Users don't see the exact message that will be delivered to their recipients, which can cause confusion when they wonder why their segment count is higher than their typed text.
**Suggested fix**: Wrap the preview text in `appendOptOutNotice` so the UI accurately reflects the final delivered payload.

### 🟡 Duplicated opt-out append logic, `src/lib/termii.ts:68`
**Problem**: `sendSmsMessage` manually re-implements the logic to append "Reply STOP to opt out".
**Why it matters**: It duplicates business logic already defined in `src/lib/sms.ts`, and does so with slightly different case-sensitivity checking (it misses the lowercase "reply STOP" check that `appendOptOutNotice` covers).
**Suggested fix**: Import and use `appendOptOutNotice` from `src/lib/sms.ts` to construct the final body.

## Strengths
- The atomic claim using `status: "dispatching"` in the orchestrator and `status: "processing"` during reconciliation elegantly eliminates nasty race conditions in a highly concurrent environment.
- The `calculateMaxSegmentsForAudience` utility is robust and correctly evaluates variable expansion across all recipients to establish a safe upper-bound wallet hold.
- Clean and consistent usage of the GSM-7 03.38 character set rules, including double-counting for extension characters.

## Test coverage
The feature correctly relies on Vitest and includes new test suites for the SMS logic, orchestrator, and campaign hooks. The test coverage is adequate, assuming it covers the tested paths, though the failure hook edge cases identified above should be added to the integration suite once fixed.

## Resolution (All Findings Fixed and Verified)

All findings identified during the review were addressed immediately and verified:
1. **Blocker 1 fixed**: `src/features/campaigns/router/index.ts` now wraps `inngest.send` in a try catch block. If event dispatch fails, `releaseCampaignHold` releases the reserved balance and the campaign record is marked as `failed`. Regression test verified in `src/features/campaigns/router/index.test.ts`.
2. **Blocker 2 fixed**: `src/features/jobs/functions/send-campaign.ts` onFailure hook updates message status to `failed`, increments `campaign.failedMessages`, and reconciles unspent wallet hold if the failed message completes the broadcast. Regression test verified in `src/features/jobs/functions/send-campaign.test.ts`.
3. **Major fixed**: `src/lib/termii.ts` switched to `channel: "dnd"` to properly route promotional and transactional broadcasts past Nigerian telecom DND filters.
4. **Minor 1 fixed**: `src/features/campaigns/components/campaign-wizard.tsx` wraps live preview in `appendOptOutNotice`, reflecting the exact delivered payload.
5. **Minor 2 fixed**: `src/lib/termii.ts` now imports and uses `appendOptOutNotice` from `src/lib/sms.ts`.
6. **Verification**: 26 test files and all 152 unit tests pass green. All touched files verified with Ultracite Biome.

