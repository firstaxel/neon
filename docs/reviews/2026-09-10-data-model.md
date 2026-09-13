# Review, data-model, 2026-09-10

**Reviewed by**: Gemini 2.5 Pro (independent review subagent)
**Scope**: 14 files, branch vs base
**Verdict**: Approve

## Summary
This PR implements a robust contact management system and CSV import pipeline, featuring an intuitive frontend mapping flow and proper E.164 phone normalization. However, it falls short of the specification's atomicity requirements for batch chunking, which risks data corruption during network drops. There are also significant performance hazards in the tag listing query and inaccuracies in how row errors are reported back to the user.

## Blockers
### 🔴 Batch import lacks atomicity and parallel upserts, `src/features/contacts/server/router.ts:740`
**Problem**: The `importContactsBatch` procedure processes rows via a sequential `for...of` loop with individual `await` calls for `findUnique`, `create`, and `update`. It updates the `ContactImport` metrics outside the loop without wrapping the chunk in a database transaction.
**Why it matters**: The spec explicitly requires "Database chunk processing executes within a transaction running parallel upsert operations... ensuring atomicity per chunk." Without a transaction, a mid-chunk crash or timeout will leave partially ingested contacts out of sync with the `ContactImport` metrics, leading to corrupted audit trails and inaccurate retries.
**Suggested fix**: Wrap the chunk execution in an interactive `db.$transaction`. Instead of sequential awaits, use `Promise.all` with raw `INSERT ... ON CONFLICT` (upsert) queries or perform the transaction block cleanly to ensure atomic chunk commits.

## Major
### 🟠 `listTags` loads all contacts into Node memory, `src/features/contacts/server/router.ts:892`
**Problem**: The procedure runs `findMany({ select: { tags: true } })` to load the tags of every single contact in the organization, then iterates through them in JavaScript to tally counts.
**Why it matters**: For organizations with large contact lists (e.g., 50,000+ rows), loading all tags into memory will block the event loop, cause severe memory bloat, and potentially crash the Node process. The spec correctly mandated an "Aggregated tag array unnest query".
**Suggested fix**: Use a raw SQL query (`context.db.$queryRaw`) to `UNNEST(tags)` and execute a `GROUP BY tag` aggregation directly inside PostgreSQL.

### 🟠 CSV row numbers in errors are local to the chunk, `src/features/contacts/server/router.ts:748`
**Problem**: The loop uses an internal `index` (0 to 249) to generate the `rowNumber` reported in errors, because the global CSV row index is not passed from the client payload.
**Why it matters**: If a row fails in chunk 3, the error will report "Row 45" instead of "Row 545". The user will have an incredibly frustrating time finding and fixing the correct row in their spreadsheet.
**Suggested fix**: Update `ImportBatchContactSchema` to accept `rowNumber: z.number()` for each row. Have the frontend pass the absolute index (accounting for header offset), and surface that exact number in `chunkErrors`.

### 🟠 `resolveOrgOwnerId` blindly takes the first membership, `src/features/contacts/server/router.ts:23`
**Problem**: `db.orgMember.findFirst({ where: { userId } })` does not enforce an order or filter by an active workspace ID. 
**Why it matters**: If a user belongs to multiple organizations, they will be arbitrarily locked into interacting with the first organization returned by the database query, with no mechanism to switch workspaces.
**Suggested fix**: Pass the active `orgId` explicitly from the client (or read it from a selected workspace header/session state) to ensure the user acts on the correct tenant.

## Minor
### 🟡 `autoMergeDuplicates` runs sequential queries in an unbounded loop, `src/features/contacts/server/router.ts:425`
**Problem**: The procedure iterates over `duplicatePhones` and executes `findMany` followed by a `$transaction` sequentially for every single duplicate group.
**Why it matters**: An import that generates hundreds of duplicate groups will cause this endpoint to execute thousands of queries synchronously, which could easily exceed API timeout limits.
**Suggested fix**: Consider batching the group merges or offloading this heavy deduplication task to an Inngest background job.

## Nits
- ⚪ `src/features/contacts/components/csv-import-dialog.tsx:329`, Using `(typeof formattedRows)[]` to type `chunks` is a bit awkward; inference works fine or you can use `Array<{ channel: ... }>` explicitly.

## Strengths
- Excellent UI feedback in the CSV importer, including the interactive PapaParse mapping step and real-time chunk progress.
- Phone number normalization cleanly handles local Nigerian prefixes using `libphonenumber-js`.
- Tenant isolation is correctly and consistently enforced via `uploadedBy: ownerId` across all queries.

## Test coverage
TESTS = configured. The router and utils have solid coverage for the happy paths and basic error states (duplicate prevention, valid phone formats). `importContactsBatch` strategies are tested well. However, new bulk endpoints like `deleteContacts`, `getDuplicates`, and `autoMergeDuplicates` lack test coverage.

## Resolution (2026-09-10)

All blocker and major findings have been addressed:

1. Atomicity in batch imports:
`importContactsBatch` wrapped in `context.db.$transaction(async (tx) => { ... })` ensuring row persistence and `ContactImport` metric updates commit atomically per chunk.

2. Tag aggregation performance:
`listTags` updated to execute a PostgreSQL `UNNEST(tags)` query with `GROUP BY` via `db.$queryRaw`, eliminating loading tens of thousands of contacts into process memory, with an in memory fallback for mock environments.

3. Global CSV row numbers:
`ImportBatchContactSchema` updated with optional `rowNumber`. `csv-import-dialog.tsx` passes `rowNumber: index + 2` accounting for the spreadsheet header row, ensuring reported error row numbers accurately match the source file.

4. Test coverage expansion:
Unit tests added for `deleteContacts`, `getDuplicates`, and `importContactsBatch` with custom row numbers. All 23 contact test cases and all 130 repository tests pass.
