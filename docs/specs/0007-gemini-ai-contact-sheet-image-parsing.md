# 0007. Gemini AI Contact Sheet Image Parsing

**Date**: 2026-09-13
**Status**: In Progress

## Summary

This specification defines the Gemini AI contact sheet image parsing system for Velocast. Users take a photo of a physical attendance sheet, paper roster, or sign in table, and upload it via direct presigned storage upload. An asynchronous Inngest background job passes the image to Google Gemini 2.5 Flash to extract names, phone numbers, and categories into a staged review list. Operators can inspect the original image side by side with the extracted table, correct any misread digits, apply batch tags, and import clean contacts into their directory with one click.

## Context

Many Nigerian organizations, including churches, alumni groups, schools, and community associations, collect attendee information on paper rosters during events and weekly meetings. Manually typing dozens or hundreds of handwritten names and phone numbers into a computer is tedious, slow, and prone to transcription errors.

Automating roster ingestion through computer vision introduces practical challenges. Nigerian phone numbers are written in diverse formats, such as local eleven digit prefixes (`0803...`, `070...`) or international prefixes (`+234...`, `234...`), often with missing digits, smeared ink, or uneven lighting. Handwriting legibility varies significantly across different signers on the same sheet.

Inserting extracted contacts straight into the main database without human oversight risks polluting the organization contact book with corrupted numbers and incorrect names. A reliable solution requires an asynchronous background processing pipeline coupled with an interactive candidate review interface. By highlighting low confidence numbers and displaying the original roster photograph alongside editable input fields, operators can verify and correct OCR mistakes before committing records to their address book.

## Requirements

**User stories**:
- As an organization administrator, I want to upload a photo of a handwritten attendance roster so that I do not have to type contact information by hand.
- As an operator, I want the system to process roster images asynchronously in the background so that large images do not freeze my browser or fail due to network timeouts.
- As an operator, I want to inspect extracted candidate contacts in an interactive review screen with the roster photo visible so that I can verify ambiguous names and fix misread digits.
- As an operator, I want visual warning badges on low confidence entries and malformed phone numbers so that I can spot potential errors quickly.
- As an operator, I want to apply batch tags and select duplicate handling rules before importing so that my directory stays tidy and properly categorized.
- As an operator, I want to commit the verified contacts with one click or dismiss the batch if the image quality was insufficient.

**Acceptance criteria**:
- **AC-1**: Users can select or capture an image file (JPEG, PNG, WebP) up to 8MB, request a presigned upload URL from Cloudflare R2, upload the file directly from the browser, and create a tracked `ParseJob` record in `pending` status.
- **AC-2**: Background job orchestration runs asynchronously through Inngest, invoking Google Gemini 2.5 Flash with structured schema extraction to produce contact names, normalized Nigerian E.164 phone numbers, message channels, category classifications, and an overall extraction confidence score (0.0 to 1.0).
- **AC-3**: Extracted candidate contacts are saved into a structured JSON staging column (`candidates`) on the `ParseJob` row with status updated to `done` and review status set to `pending_review`, keeping the main directory `Contact` table untouched prior to operator confirmation.
- **AC-4**: The system calculates a confidence rating for each candidate entry and flags items whose confidence is below 0.70 or whose phone number deviates from standard Nigerian prefixes (`234...` with ten following digits) with visible warning badges in the review table.
- **AC-5**: The review interface presents a temporary presigned download link to view the original roster photo alongside an editable table where operators can modify contact names, alter phone numbers, toggle individual inclusion, or remove invalid rows.
- **AC-6**: The review interface allows operators to specify batch tags (such as "Sunday Service 2026-09-13") and choose a deduplication strategy (`skip_duplicates`, `overwrite`, or `tags_only`) applied during import.
- **AC-7**: Confirming the import executes an atomic database transaction that generates a `ContactImport` audit row, inserts or updates contacts according to the selected strategy, links created contacts to the `ParseJob`, and marks the job review status as `committed`.
- **AC-8**: Operators can dismiss a parse job, which updates its review status to `dismissed` without creating contacts and allows safe removal of temporary storage assets.

## Options considered

### Option 1: Asynchronous Inngest Extraction with Staged Candidate Review (Chosen)

The client uploads the roster image directly to Cloudflare R2 via a presigned URL, and calls an oRPC endpoint to create a `ParseJob` row and trigger an Inngest event. The background Inngest worker downloads the image, invokes Gemini 2.5 Flash for structured extraction, and stores candidate rows in a JSON column on `ParseJob`. The user inspects candidates in an interactive review screen, corrects entries, and triggers an import procedure that atomically commits records to the directory.

**Pros**:
- Protects the contact directory against OCR errors by requiring explicit operator review before writing records.
- Keeps browser and API response times fast because heavy vision processing occurs in background workers.
- Avoids large payload transfers through web application servers by using direct R2 presigned storage uploads.
- Accommodates retries and network interruptions gracefully through Inngest durability.

**Cons**:
- Requires storing uncommitted candidates in a JSON staging structure before directory persistence.

### Option 2: Synchronous Extraction in oRPC Request Handler

The client submits the image file directly to an oRPC endpoint, which waits synchronously for Gemini to process the image and returns extracted rows in the HTTP response.

**Pros**:
- Eliminates background queues and polling logic.

**Cons**:
- Risks HTTP timeouts when processing high resolution photographs on slower mobile connections.
- Consumes server memory by buffering large image uploads in process.

### Option 3: Immediate Directory Upsert without Review

The Inngest worker extracts contacts and immediately upserts them into `prisma.contact` using phone uniqueness rules, bypassing operator review.

**Pros**:
- Requires fewer user clicks and simpler frontend components.

**Cons**:
- Pollutes the contact book with OCR hallucinations, misspelled names, and truncated phone numbers.
- Destroys user trust when corrupted entries receive unintended bulk broadcasts.

## Decision

**Chosen option**: Option 1: Asynchronous Inngest Extraction with Staged Candidate Review

We implement asynchronous roster parsing using direct R2 presigned uploads, Inngest background extraction via Gemini 2.5 Flash, and a candidate review gate prior to contact directory persistence.

**Implementation skills**: `tanstack-start` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-start/`) · `tanstack-form` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-form/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `inngest-durable-functions` (`inngest/inngest-skills`, `.agents/skills/inngest-durable-functions/`) · `orpc` (`orpc/skills`, `.agents/skills/orpc/`)

## Rationale

Physical roster sheets in Nigeria are rarely uniform. Lighting variations, different handwriting styles on a single sheet, and varied pen inks mean OCR accuracy cannot reach one hundred percent certainty. Directly upserting uninspected contacts into an organization messaging directory risks dispatching broadcasts to invalid numbers or insulting recipients with mangled names.

Option 1 provides the right balance between automation speed and human quality control. Moving the file upload directly to Cloudflare R2 keeps web server resource usage minimal. Inngest handles model retries and timeout boundaries. Staging the candidates in `ParseJob` allows operators to spend thirty seconds reviewing the photo and fixing ambiguous digits, guaranteeing pristine directory quality while eliminating ninety percent of manual typing labor.

## Feature design

**Data model sketch**:

```prisma
enum ParseJobStatus {
  pending
  parsing
  done
  error
}

enum ParseJobReviewStatus {
  pending_review
  committed
  dismissed
}

model ParseJob {
  id               String               @id @default(uuid())
  status           ParseJobStatus       @default(pending)
  reviewStatus     ParseJobReviewStatus @default(pending_review) @map("review_status")

  r2Key            String               @map("r2_key")
  r2Bucket         String               @map("r2_bucket")
  originalFilename String?              @map("original_filename")
  mimeType         String               @map("mime_type")
  fileSizeBytes    Int?                 @map("file_size_bytes")

  rawExtractedText String?              @map("raw_extracted_text") @db.Text
  confidence       Float?
  warnings         String[]             @default([])
  errorMessage     String?              @map("error_message")

  candidates       Json?                // Staged candidate contacts awaiting review
  tagsApplied      String[]             @default([]) @map("tags_applied")
  strategy         ImportStrategy       @default(skip_duplicates)

  inngestEventId   String?              @map("inngest_event_id")

  createdAt        DateTime             @default(now()) @map("created_at")
  startedAt        DateTime?            @map("started_at")
  completedAt      DateTime?            @map("completed_at")

  parsedBy         String               @map("parsed_by")
  user             User                 @relation(fields: [parsedBy], references: [id], onDelete: Cascade)

  contacts         Contact[]

  @@index([status])
  @@index([reviewStatus])
  @@index([parsedBy])
  @@index([createdAt(sort: Desc)])
  @@map("parse_jobs")
}
```

**State transitions**:
- Extraction lifecycle: `pending` (uploaded and queued) &rarr; `parsing` (worker running Gemini vision) &rarr; `done` (candidates extracted and ready for review) OR `error` (vision extraction failure).
- Review lifecycle: `pending_review` (awaiting user verification) &rarr; `committed` (contacts confirmed and saved to directory) OR `dismissed` (operator rejected batch).

**API surface**:

| Procedure | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `upload.getUploadPresignedUrl` | POST | `filename: string`, `fileSizeBytes: number`, `mimeType: string` | `jobId: string`, `presignedUrl: string`, `r2Key: string`, `expiresInSeconds: number` | protected | 400 invalid type or excessive size, 401 unauthorized |
| `upload.confirmDirectUpload` | POST | `jobId: string`, `filename: string`, `fileSizeBytes: number`, `mimeType: string`, `r2Key: string` | `jobId: string`, `message: string` | protected | 401 unauthorized, 404 not found |
| `upload.getParseStatus` | GET | `jobId: string` | `jobId: string`, `status: ParseJobStatus`, `progress: number`, `confidence: number`, `warnings: string[]`, `totalExtracted: number`, `error?: string` | protected | 401 unauthorized, 404 not found |
| `upload.getParseJob` | GET | `jobId: string` | `jobId: string`, `status: ParseJobStatus`, `reviewStatus: ParseJobReviewStatus`, `imageUrl: string`, `candidates: array`, `confidence: number`, `warnings: string[]`, `createdAt: string` | protected | 401 unauthorized, 404 not found |
| `upload.commitParsedJob` | POST | `jobId: string`, `contacts: array`, `tags: string[]`, `strategy: ImportStrategy` | `jobId: string`, `importId: string`, `createdCount: number`, `updatedCount: number`, `skippedCount: number` | protected | 400 invalid rows or already committed, 401 unauthorized, 404 not found |
| `upload.dismissParseJob` | POST | `jobId: string` | `jobId: string`, `reviewStatus: string` | protected | 400 already committed, 401 unauthorized, 404 not found |
| `upload.listParseJobs` | GET | none | `jobs: array` | protected | 401 unauthorized |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| `getUploadPresignedUrl` | `presignedUrl` | Generated via AWS S3 Request Presigner using Cloudflare R2 credentials |
| `confirmDirectUpload` | `jobId` | Client supplied UUID generated during presigned URL request |
| `confirmDirectUpload` | `inngestEventId` | Returned from `inngest.send("Velocast/contact-list.parse")` |
| `geminiParseStep` | `candidates` | Extracted from Gemini 2.5 Flash response text matching JSON schema |
| `geminiParseStep` | `confidence` | Numeric rating (0.0 to 1.0) calculated from Gemini response metadata |
| `getParseJob` | `imageUrl` | Generated presigned download URL for R2 object with five minute expiration |
| `commitParsedJob` | `createdCount` | Count of inserted records in atomic `prisma.$transaction` |
| `commitParsedJob` | `updatedCount` | Count of updated existing records matching `@@unique([userId, phone])` |

**Key invariants**:
- Directory isolation: candidate contacts must never appear in `prisma.contact` queries until `commitParsedJob` completes.
- Idempotent confirmation: a `ParseJob` can only be committed once; subsequent attempts return an invalid state error.
- Phone normalization: all extracted and edited phone numbers are normalized to E.164 Nigerian format without leading plus sign (`234...`).
- Tenant isolation: operators can only query, review, commit, or dismiss parse jobs where `parsedBy` equals their authenticated user identifier.

**Security model**:
- All parse procedures require authenticated sessions verified through `protectedProcedure`.
- Cloudflare R2 bucket remains private; access is granted strictly through short lived presigned URLs generated server side.
- Uploaded file types are restricted to safe image formats (`image/jpeg`, `image/png`, `image/webp`) with an 8MB size limit.

**Configuration required**:
- `GEMINI_API_KEY`: API key for Google Gemini Generative AI vision service.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account identifier for R2 endpoint.
- `CLOUDFLARE_ACCESS_KEY_ID`: Access key credential for R2 S3 compatibility.
- `CLOUDFLARE_SECRET_ACCESS_KEY`: Secret key credential for R2 S3 compatibility.
- `R2_BUCKET_NAME`: Bucket name for storing uploaded roster photographs.

**Critical test scenarios**:
- Happy path: Operator uploads photo via presigned URL, Inngest triggers Gemini vision extraction, candidates populate in review screen, operator edits one phone number, adds tag, commits batch, and contacts populate directory, verifies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-6**, **AC-7**.
- Low confidence warning: Uploaded roster has faint handwriting; candidate row receives confidence score of 0.55; review table displays warning alert, verifies **AC-4**.
- Invalid phone handling: Extracted row has nine digits; table flags number as invalid; user corrects to eleven digits before confirmation, verifies **AC-4**, **AC-5**.
- Duplicate phone resolution: Extracted number already exists in directory; operator selects `skip_duplicates` strategy; import increments `skippedCount` and leaves existing contact untouched, verifies **AC-6**, **AC-7**.
- Batch dismissal: Operator rejects poorly focused photograph; calls `dismissParseJob`; job marks `dismissed` and no contacts are written, verifies **AC-8**.

## Build plan

Following our project Tracer Bullet approach, we construct a thin end to end thread connecting the presigned upload, Inngest background vision extraction, staged candidate storage, review UI, and atomic directory commitment.

1. [x] Update database schema with migration adding `reviewStatus`, `candidates`, `tagsApplied`, and `strategy` to `ParseJob`, satisfies **AC-3**
2. [x] Refactor Gemini vision extractor in `src/lib/gemini.ts` to output structured candidate records with per item confidence ratings and validation warnings, satisfies **AC-2**, **AC-4**
3. [x] Update Inngest background job in `src/features/jobs/functions/parse-contacts.ts` to save extracted candidates to `ParseJob.candidates` in staging status without touching directory contacts, satisfies **AC-2**, **AC-3**
4. [x] Implement oRPC procedures in `src/features/upload/router/index.ts` for fetching candidate details with presigned image download links, committing reviewed contacts, and dismissing batches, satisfies **AC-1**, **AC-5**, **AC-6**, **AC-7**, **AC-8**
5. [x] Build interactive roster review component in `src/features/parsing/components/roster-review.tsx` featuring side by side image preview, confidence warning indicators, editable table inputs, and batch tag selector, satisfies **AC-4**, **AC-5**, **AC-6**
6. [x] Wire roster review screen into dashboard routing and connect polling hooks for real time progress updates, satisfies **AC-1**, **AC-5**, **AC-7**
7. [x] Write automated unit and integration tests covering presigned upload initiation, candidate staging persistence, duplicate strategy resolution, and batch dismissal, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-6**, **AC-7**, **AC-8**

## Consequences

**Positive**:
- Eliminates manual typing labor for organizations collecting physical rosters while maintaining high directory data hygiene.
- Keeps web application servers fast and lightweight through direct presigned storage uploads.
- Visual confidence alerts and side by side image preview make human verification effortless.
- Deduplication strategies ensure existing customer tags and notes are preserved.

**Negative / tradeoffs**:
- Storing uncommitted candidate contacts in JSON columns introduces a small amount of redundant database storage until dismissal or cleanup.
- Vision processing with Gemini API incurs minor external API operational costs.

**Neutral**:
- Requires active Google Gemini API key and Cloudflare R2 bucket credentials.

## Follow-up

- [ ] Implement thirty day scheduled cleanup cron to prune raw roster images from Cloudflare R2 after import commitment.
- [ ] Evaluate multi page PDF roster upload support for larger school and convention directories in a future slice.

