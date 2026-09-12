# Verify: Contact management and CSV import · spec 0005 · updated 2026-09-10
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Open contact directory (`/contacts`) → table renders contacts with channels, tags, and search input → AC-6
- [ ] Click "Import CSV" button → upload dialog appears with file drag and drop zone → AC-1
- [ ] Drop a sample CSV file with headers (e.g. `Full Name`, `Mobile`, `Category`, `Notes`) → file parses in browser and shows column mapping selectors and live phone preview → AC-1, AC-2
- [ ] Map columns to Name, Phone Number, Tags, Notes and observe live preview → local Nigerian numbers (e.g. `08012345678`) display normalized E.164 green badge (`+2348012345678`) and invalid strings highlight in red → AC-1, AC-2
- [ ] Choose duplicate handling strategy (`skip_duplicates`, `overwrite`, or `tags_only`) and click "Start Import" → progress bar updates sequentially across 250 row chunks with live counts of created, updated, and skipped rows → AC-3, AC-4, AC-9
- [ ] Once completed, view import completion summary with total counts and error report download if rows failed → AC-3, AC-5
- [ ] Open "Import History" dialog → previous import runs display filename, date, strategy, status, row totals, and error counts → AC-5
- [ ] Filter contacts directory by tag dropdown → table updates immediately to display only contacts with selected tag → AC-7
- [ ] Select multiple contacts via row checkboxes → bulk actions bar appears showing selected count, "Add/Remove Tags", and "Delete" → AC-7, AC-8
- [ ] Click "Add/Remove Tags" in bulk banner → bulk tag dialog opens, enter tag to add or remove and submit → tags update across all selected contacts → AC-7
- [ ] Click "Delete" in bulk banner and confirm → selected contacts are removed from directory → AC-8
- [x] Test value sourcing for phone normalization → raw Nigerian input transforms to E.164 with +234 prefix → AC-2
- [x] Test value sourcing for workspace owner → contacts created by organization members attach to the organization owner ID → AC-6
- [x] Test value sourcing for duplicate strategy → existing contact tags merge without losing prior tags when using tags_only or overwrite → AC-4

## Commands
- [x] `bun test src/features/contacts/server/router.test.ts` → 12 router tests pass with zero failures → AC-3, AC-4, AC-5, AC-7, AC-8
- [x] `bun test src/features/contacts/utils/phone.test.ts` → 8 phone normalization tests pass with zero failures → AC-2
- [x] `bun x tsc --noEmit` → TypeScript compiler exits cleanly with zero errors → AC-1, AC-3, AC-5, AC-6

## Acceptance criteria coverage
- AC-1 covered by UI steps 2, 3, 4 · AC-2 covered by UI steps 3, 4, 12 and phone test command · AC-3 covered by UI steps 5, 6 and router test command · AC-4 covered by UI steps 5, 14 and router test command · AC-5 covered by UI steps 6, 7 and router test command · AC-6 covered by UI steps 1, 13 · AC-7 covered by UI steps 8, 9, 10 and router test command · AC-8 covered by UI steps 9, 11 and router test command · AC-9 covered by UI step 5
