# 0005. Contact Management and CSV Import

**Date**: 2026-09-10
**Status**: Accepted

## Summary

This specification defines the contact address book enhancement and CSV import system for Velocast. Users can inspect paginated contacts, manage tags, resolve duplicate phone numbers, and import contacts in bulk from CSV spreadsheets. The import workflow runs in browser preview with interactive column mapping, normalizes phone numbers to international E.164 standards, and commits batches sequentially through type safe procedures with audit tracking.

## Requirements

**User stories**:
- As an organization administrator, I want to upload contact lists from CSV files so that I can assemble broadcast audiences quickly without manual data entry.
- As an administrator, I want to map spreadsheet columns visually to contact properties so that my import succeeds regardless of header naming differences in source files.
- As an administrator, I want duplicate phone numbers detected and resolved according to my chosen policy so that my contact directory stays clean and accurate.
- As an administrator, I want to organize contacts with tags and apply bulk actions so that I can segment audiences for targeted SMS and WhatsApp campaigns.

**Acceptance criteria**:
- **AC-1**: Users can parse and preview a local CSV file in the browser using PapaParse with automatic delimiter detection, UTF-8 byte order mark removal, and interactive column mapping for name, phone, email, channel, type, and tags.
- **AC-2**: Phone numbers are validated and normalized to strict E.164 format via libphonenumber-js with default country code NG (+234), while cleanly supporting valid international numbers and rejecting malformed inputs with row level error explanations.
- **AC-3**: CSV rows are ingested in sequential batch chunks of up to 250 records through an atomic oRPC procedure with a visible progress indicator and real time tally of created, updated, and skipped rows.
- **AC-4**: Duplicate phone numbers encountered during CSV import resolve according to a pre selected user strategy (skip existing contacts, overwrite existing contact values, or append tags to existing contacts).
- **AC-5**: Each CSV import execution records an audit entry in the ContactImport table with file name, row counts, timestamp, and an array of row level errors for review and inspection.
- **AC-6**: Organization members automatically view, add, update, and manage contacts scoped to their organization owner identifier, enabling shared contact book access across team members.
- **AC-7**: Users can assign freeform tags to contacts, filter the paginated contact directory by tag, and execute bulk tagging mutations on up to 500 selected contacts in a single action.
- **AC-8**: Contacts can be updated or manually deleted individually and in bulk selections up to 500 contacts, with conservative opt out preservation ensuring unsubscribed contacts remain opted out during merges and updates.
- **AC-9**: Partial batch failures or transient network drops during multi chunk imports preserve committed chunks and permit retrying remaining rows without creating duplicate contact rows.

## Feature design

**Data model sketch**:

```prisma
enum ImportStatus {
  in_progress
  completed
  failed
}

enum ImportStrategy {
  skip_duplicates
  overwrite
  tags_only
}

model ContactImport {
  id           String         @id @default(uuid())
  ownerId      String         @map("owner_id")
  uploadedBy   String         @map("uploaded_by")
  user         User           @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  filename     String
  status       ImportStatus   @default(in_progress)
  strategy     ImportStrategy @default(skip_duplicates)
  totalRows    Int            @map("total_rows")
  createdCount Int            @default(0) @map("created_count")
  updatedCount Int            @default(0) @map("updated_count")
  skippedCount Int            @default(0) @map("skipped_count")
  errorCount   Int            @default(0) @map("error_count")
  errors       Json?          // Array of { rowNumber: number, phone: string, reason: string }
  tagsApplied  String[]       @default([]) @map("tags_applied")
  createdAt    DateTime       @default(now()) @map("created_at")

  contacts     Contact[]

  @@index([ownerId])
  @@index([status])
  @@map("contact_imports")
}

// Enhanced Contact model additions
model Contact {
  // Existing fields: id, uploadedBy, parseJobId, name, phone, channel, type, tags, email, notes, rawRow, optedOut, optedOutAt, lastInboundAt, createdAt
  importBatchId String?        @map("import_batch_id")
  importBatch   ContactImport? @relation(fields: [importBatchId], references: [id], onDelete: SetNull)
  metadata      Json?          // Key value custom fields from unmapped CSV columns

  @@index([importBatchId])
}
```

**State transitions**:
Import progress transitions sequentially within the client session:
1. `idle`: File selector waiting for user file drop.
2. `parsing`: PapaParse reading local file, extracting headers and sample rows.
3. `mapping`: User reviewing detected columns and assigning fields (Name, Phone, Tags, Channel, Type).
4. `importing`: Initial chunk creates `ContactImport` record with `status: in_progress` and `totalRows`, then sends sequential 250 row chunks to `importContactsBatch`.
5. `completed`: Final chunk marks `status: completed`. Summary modal reports total created, updated, skipped, and error details.

**API surface**:

| Procedure | Protocol | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `contacts.importBatch` | oRPC Protected | `importBatchId` (optional UUID), `totalRows` (integer, required on initial chunk), `isLastChunk` (boolean, default false), `filename`, `strategy`, `defaultTags`, `defaultChannel`, `defaultType`, `contacts` (array of up to 250 rows) | `importBatchId`, `created`, `updated`, `skipped`, `errors` | Protected Session | 400 Validation, 401 Unauthorized, 403 Forbidden |
| `contacts.listImports` | oRPC Protected | `page`, `pageSize` | `imports` array, `pagination` | Protected Session | 401 Unauthorized |
| `contacts.getImportDetails` | oRPC Protected | `id` (UUID) | Full import record including `errors` array | Protected Session | 404 Not Found, 401 Unauthorized |
| `contacts.listTags` | oRPC Protected | `search` (optional) | `tags` array of `{ tag: string, count: number }` | Protected Session | 401 Unauthorized |
| `contacts.batchTag` | oRPC Protected | `contactIds` (array of up to 500 UUIDs), `addTags`, `removeTags` | `updatedCount`, `success` | Protected Session | 400 Bad Request, 401 Unauthorized |
| `contacts.deleteContacts` | oRPC Protected | `ids` (array of up to 500 UUIDs) | `deleted`, `success` | Protected Session | 400 Bad Request, 401 Unauthorized |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| `contacts.importBatch` | Contact name | Input CSV column mapped to name, trimmed of whitespace |
| `contacts.importBatch` | Contact email | Input CSV column mapped to email, trimmed, lowercase, null if blank |
| `contacts.importBatch` | Normalized phone number | Input CSV column mapped to phone, normalized to E.164 by libphonenumber-js |
| `contacts.importBatch` | Contact channel | Input CSV channel column, falling back to user chosen default channel in import modal |
| `contacts.importBatch` | Contact type | Input CSV type column, falling back to user chosen default type in import modal |
| `contacts.importBatch` | Contact tags | Split from CSV tags cell (comma or semicolon), merged with optional modal default tags |
| `contacts.importBatch` | Custom metadata attributes | Unmapped CSV columns collected into JSON object, stored in `Contact.metadata` |
| `contacts.importBatch` | Opted out flag status | Conservative boolean resolution: existing contact `optedOut` value or false if new |
| `contacts.importBatch` | Organization ownership | Organization owner ID resolved via session and `orgMember` owner lookup in procedure context |
| `contacts.importBatch` | Batch audit metrics | Count of created, updated, skipped, and error rows computed during chunk execution |
| `contacts.importBatch` | Import status | Set to `in_progress` on creation, transitioned to `completed` when `isLastChunk` is true |
| `contacts.importBatch` | Blank cell overwrite resolution | If incoming cell is empty, preserve existing database value; only overwrite with non empty values |
| `contacts.listContacts` | Contact duplicate indicator | In memory set lookup derived from phone duplicate count query when duplicatesOnly is active |
| `contacts.listTags` | Unique tag list with counts | Aggregated tag array unnest query scoped to organization owner ID |
| `contacts.batchTag` | Updated contact count | Count of contact rows updated in Prisma transaction scoped to organization owner |

**Key invariants**:
- Phone numbers in PostgreSQL must always conform to E.164 format (+ followed by country code and subscriber number).
- Contacts are unique per organization owner and phone number: `@@unique([uploadedBy, phone])`.
- If an existing contact has `optedOut = true`, subsequent updates or merges must never reset `optedOut` to `false` unless an explicit re opt in process is executed.
- Overwrite strategy is non destructive for blank cells: empty CSV values do not clear existing contact names, emails, or notes.
- Import lifecycle reflects `in_progress` until the final chunk commits, transitioning `ContactImport.status` to `completed`.
- Database chunk processing executes within a transaction running parallel upsert operations on PostgreSQL, ensuring atomicity per chunk.
- Batch import chunks must not exceed 250 contacts per HTTP request.
- Bulk table mutations must not exceed 500 contacts per request.

**Security model**:
- All contact management procedures require an authenticated user session validated by server middleware.
- Data isolation is enforced at the organization level: if the user belongs to an organization as a member, operations resolve the organization owner identifier (`ownerId`) and scope database queries to that identifier.
- PII data (customer names, phone numbers, email addresses) is scoped strictly to the organization and never leaked across organizations.

**Configuration required**:
- No new environment variables required. Existing PostgreSQL connection and Better Auth sessions support this feature.

**Critical test scenarios**:
- Happy path: User drops a CSV file with 500 Nigerian contacts in mixed formats (080..., 234...), maps columns, selects skip duplicates strategy, and verifies 500 contacts created with +234 prefixes across two 250 row chunks, verifies **AC-1**, **AC-2**, **AC-3**, **AC-5**.
- Duplicate strategy verification: User imports a CSV with numbers already present in the database under `overwrite` strategy, verifying contact names and notes update while existing tags are retained, verifies **AC-4**, **AC-8**.
- Invalid phone handling: User imports a file containing invalid phone numbers (e.g. letters, short numbers), verifying invalid rows are rejected with explicit error messages and valid rows are committed, verifies **AC-2**, **AC-5**.
- Multi chunk partial recovery: Simulating network interruption during chunk two of three, ensuring chunk one remains committed in database and chunk two can be resubmitted without duplicating chunk one records, verifies **AC-9**.
- Bulk tag assignment: User selects 100 contacts in the directory table, applies a "Youth Conference" tag, and verifies all selected contacts reflect the tag in database queries and tag filtering, verifies **AC-7**.
- Team member workspace access: User logged in as an organization member views and imports contacts, verifying records belong to the organization owner and are visible to other members, verifies **AC-6**.

## Build plan

Following the project Tracer Bullet approach, we construct a thin end to end thread connecting the database schema, normalization utilities, procedure endpoint, and UI import dialog first, then thicken with bulk tagging, filtering, and audit history.

1. [x] Create and apply Prisma schema migration adding `ContactImport` table and optional `importBatchId` plus `metadata` fields on `Contact`, satisfies **AC-5**
2. [x] Implement server side phone normalization and validation utilities using libphonenumber-js with E.164 output and Nigerian prefix defaults, satisfies **AC-2**
3. [x] Implement `importContactsBatch` and `listImports` oRPC procedures with duplicate resolution strategies (skip, overwrite, tags only) and audit logging, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-9**
4. [x] Implement `listTags` and `batchTagContacts` procedures supporting auto complete and bulk tagging operations, satisfies **AC-7**
5. [x] Build client side CSV import dialog with PapaParse streaming, delimiter auto detection, column mapping interface, and chunked batch upload progress bar, satisfies **AC-1**, **AC-3**, **AC-9**
6. [x] Enhance contacts table view with tag filtering, bulk selection actions (bulk delete, bulk tag assignment), and import history modal, satisfies **AC-6**, **AC-7**, **AC-8**

## Consequences

**Positive**:
- Users can import thousands of contacts in minutes with clear column mapping and error handling.
- Phone numbers are universally normalized to E.164, eliminating downstream delivery errors in SMS and WhatsApp campaigns.
- Flexible duplicate strategies prevent accidental overwrites or duplicate entries.
- Tags enable granular audience segmentation for targeted broadcast scenarios.

**Negative / tradeoffs**:
- Browser based parsing requires the user to keep the tab open during file upload.
- Very large files (exceeding 10,000 rows) take several minutes to upload over sequential chunks.

**Neutral**:
- The project adds `papaparse` and `libphonenumber-js` packages to application dependencies.

## Follow-up

- [ ] Add CSV export template download button in import modal to provide users with a pre formatted reference file.
- [ ] Connect Slice 2 Gemini AI parsing results to the same `importBatch` procedure for consistent contact insertion.

## Migration plan

**Strategy**: Strangler (incremental addition alongside existing contacts).

**Phases**:
1. Phase 1: Apply Prisma migration adding the new `ContactImport` model and nullable `importBatchId` and `metadata` columns to `Contact`. Existing contact rows remain untouched.
2. Phase 2: Deploy backend oRPC procedures (`importBatch`, `listTags`, `batchTag`) with test suite coverage.
3. Phase 3: Deploy frontend CSV import dialog and enhanced table components.

**Rollback**:
- If Phase 1 requires rollback before production traffic, drop table `contact_imports` and remove the two nullable columns from `contacts`.
- Reverting the application commit restores previous contact table behavior without data loss.

**Risks**:
- Concurrent CSV uploads with overlapping phone numbers: Handled by PostgreSQL row level upsert logic and unique constraint on `[uploadedBy, phone]`.
