# Verify: Gemini AI contact sheet image parsing · spec 0007 · updated 2026-09-13
_Steps derived from spec 0007 acceptance criteria. /check verify runs these; /test locks the durable ones._

## UI / manual
- [x] Operator selects image file and requests presigned upload URL from Cloudflare R2 → returns upload PUT URL and creates ParseJob in pending status → AC-1
- [x] Direct upload confirmation queues Inngest parse event → Inngest event ID stored and background job started → AC-1, AC-2
- [x] Background Inngest worker executes Gemini vision structured extraction → produces candidate records with names and normalized Nigerian numbers without directory pollution → AC-2, AC-3
- [x] Staged candidates populated in ParseJob candidates column with review status pending_review → directory Contact table remains completely untouched → AC-3
- [x] Low confidence candidate rows (below 0.70) or invalid phone formats flagged with visible warning badges in review screen → AC-4
- [x] Review dialog displays temporary presigned download link to inspect original roster photo side by side with candidate table → AC-5
- [x] Operator modifies candidate names, edits phone numbers, and toggles individual inclusion checkboxes → AC-5
- [x] Operator adds batch tags (such as Sunday Service 2026-09-13) and selects duplicate handling strategy (skip_duplicates, overwrite, or tags_only) → AC-6
- [x] Clicking commit executes atomic database transaction creating ContactImport audit row, inserting or updating directory contacts, linking parseJobId, and marking job committed → AC-7
- [x] Recommitting an already committed job throws an invalid state error to ensure idempotency → AC-7
- [x] Operator clicks dismiss batch → updates review status to dismissed without writing contacts to the directory → AC-8

## Commands
- [x] `bun run test src/features/upload/router/index.test.ts` → 13 unit tests pass covering presigned upload, staging retrieval, duplicate strategies, commit transaction, and dismissal → AC-1, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [x] `bun run test src/features/parsing/components/roster-review.test.tsx` → 6 component tests pass verifying candidate table, warnings, photo inspect dialog, tagging, and mutations → AC-4, AC-5, AC-6, AC-7, AC-8
- [x] `bun run test` → full test suite passes with 28 test files and 171 tests → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
- [x] `bun x tsc --noEmit` → TypeScript compiler exits cleanly with zero errors → AC-1, AC-3, AC-5, AC-7
- [x] `bun x ultracite check <feature files>` → Biome linter and formatter report zero errors or warnings across all modified surfaces → AC-1, AC-3, AC-5, AC-7
- [x] Runtime verification script on live PostgreSQL and Inngest dev server → executed live presigned URL creation, database staging, directory isolation check, image URL presigning, atomic commit transaction, idempotent rejection, and batch dismissal → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8

## Acceptance criteria coverage
- AC-1 covered by UI steps 1, 2, upload router tests, and live runtime script
- AC-2 covered by UI steps 2, 3, upload router tests, and Inngest worker
- AC-3 covered by UI steps 3, 4, upload router tests, and live runtime script
- AC-4 covered by UI step 5, roster review component tests, and upload router tests
- AC-5 covered by UI steps 6, 7, roster review component tests, and upload router tests
- AC-6 covered by UI step 8, roster review component tests, and upload router tests
- AC-7 covered by UI steps 9, 10, roster review component tests, and upload router tests
- AC-8 covered by UI step 11, roster review component tests, and upload router tests

