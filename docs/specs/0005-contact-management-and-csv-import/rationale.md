# 0005. Contact Management and CSV Import (Rationale)

**Date**: 2026-09-10
**Status**: Approved

## Context

Velocast is a multi channel broadcast platform that delivers SMS messages via Termii and WhatsApp messages via Meta Cloud API. Organizations using Velocast maintain lists of members, prospects, and customers. These audience lists are often provided as spreadsheet exports from church management systems, school rosters, event registrations, or CRM databases.

The current application contains early contact endpoints and a basic contact table. However, it lacks a functional CSV import mechanism, structured batch upload handling, and interactive column mapping. Without a dedicated import pipeline, users must enter contacts one by one or rely on external database seeding.

In addition, phone numbers originating from Nigerian sources frequently arrive in heterogeneous formats such as local zero prefixes (08031234567), unformatted strings, spaces, and international country codes (+2348031234567). Storing inconsistent phone formats degrades deduplication, risks database constraint violations, and causes message dispatch failures during campaign execution. Providing a robust CSV import pipeline with client side validation and strict E.164 normalization solves these operational obstacles before audience campaigns launch.

## Options considered

### Option 1: Client side preview with PapaParse and chunked oRPC batch ingestion

The browser reads and parses the CSV file locally using PapaParse. The user sees a sample preview of rows and maps CSV columns (such as full name, mobile number, group tag) to contact model properties. The client validates phone numbers and sends data in sequential batches of 250 rows to an atomic oRPC procedure.

**Pros**:
- Immediate user feedback with zero server processing overhead until the user confirms column mapping.
- Memory efficient for the server because large files are never uploaded as monolithic payloads.
- Clear visual error preview where invalid rows are highlighted before committing.

**Cons**:
- The browser tab must stay open while chunks are uploading.

### Option 2: Server side upload to object storage with Inngest background queue

The browser uploads the raw CSV file directly to S3 or server storage. An Inngest background job parses the file, normalizes phone numbers, writes to PostgreSQL, and notifies the client via polling or realtime events.

**Pros**:
- Can process massive spreadsheets exceeding 50,000 rows without keeping the browser active.
- Durable background execution with automatic retries managed by Inngest.

**Cons**:
- Requires cloud object storage infrastructure, presigned upload URLs, and complex column mapping schemas.
- Slower user feedback loop for typical small to medium contact rosters (under 5,000 rows).
- Higher operational complexity for a core day one workflow.

### Option 3: Synchronous monolithic form upload

The user selects a CSV file and submits it via a multipart form post. The server parses the whole file in memory during the HTTP request and returns an all or nothing response.

**Pros**:
- Simple implementation requiring fewer frontend components.

**Cons**:
- Prone to HTTP gateway timeouts on moderate rosters.
- No opportunity for the user to map non standard column headers or preview records before committing.
- Fails completely if any individual row contains an unhandled validation error.

## Decision

**Chosen option**: Option 1: Client side preview with PapaParse and chunked oRPC batch ingestion.

We adopt browser side CSV parsing using PapaParse with an interactive column mapping interface, strict E.164 phone normalization using libphonenumber-js, and sequential 250 row chunk ingestion via oRPC.

**Implementation skills**: `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `orpc` (`orpc/orpc`, `.agents/skills/orpc/`) · `tanstack-start` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-start/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`)

## Rationale

Most contact lists in Velocast range between 50 and 5,000 contacts (school classes, church units, business client lists). Processing this scale directly in the browser with PapaParse provides instant gratification and empowers users to inspect columns, map custom field names, and catch telephone formatting mistakes before any database rows are written.

Chunking the upload into batches of 250 rows protects the Nitro server runtime from memory spikes, avoids request payload limits, and provides a continuous progress indicator. Coupling this with strict E.164 normalization via libphonenumber-js ensures every phone number stored in PostgreSQL is immediately dispatchable by Termii and Meta Cloud API without runtime formatting ambiguity.

Option 2 introduces object storage and background worker overhead that is disproportionate for this phase. Inngest background queues remain available in Slice 2 for AI image parsing where processing takes prolonged computation. Option 3 is rejected because monolithic synchronous uploads lack column mapping flexibility and suffer from gateway timeout risks.
