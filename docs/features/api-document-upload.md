# API document upload

Sprint 4. Attach a real API spec (OpenAPI 3, Swagger 2, or a Postman v2.1 collection) to an
application, have Pulse parse it into a normalised endpoint list, and re-upload later versions
without losing per-endpoint setup. Full detail: [04-data-model.md](../04-data-model.md),
[07-security.md](../07-security.md), [03-architecture.md](../03-architecture.md).

This sprint's job is entirely "get the endpoint list right" — sprint 5 runs checks against these
endpoints.

## Roles

Same three roles as identity ([identity-and-tenancy.md](./identity-and-tenancy.md#roles)). Within
an organisation: Admin can upload/import documents and edit endpoint setup (include/exclude,
sample values); Admin and Viewer can both list documents and view the endpoint list.

## Flows

**Upload / import** — `POST /applications/:id/documents` (Admin only) — a "Documents" section on
`/applications/:id` in the web app, either a file picker (multipart) or a URL field. Stores the
raw file, computes its SHA-256 checksum, detects its format, and creates an `ApiDocument` row with
`status: PENDING` — all synchronous, in the request. The actual validation/parsing happens
asynchronously (see below).

**List versions** — `GET /applications/:id/documents` (Admin or Viewer) — the same section, a
table polling (TanStack Query `refetchInterval`) while any version is `PENDING`.

**View endpoints** — `GET /documents/:id/endpoints` (Admin or Viewer) — `/applications/:id/endpoints`
in the web app, grouped client-side by the first path segment (the schema has no `tag` column).

**Edit endpoint setup** — `PATCH /endpoints/:id` (Admin only) — `{ included?, sampleParams?,
sampleBody? }`. Write-method confirmation (`writeEnabled`/`writeConfirmedBy`/`allowInSchedule`)
is sprint 5's job — those columns exist in the schema now but nothing sets them yet.

## Why parsing is asynchronous

The security table (technical plan section 8) requires "parsing in the worker with a time limit" —
a malicious spec file is exactly the kind of untrusted input that shouldn't run inline in a
request handler. So the upload endpoint only does the cheap, safe half (store, checksum, detect
format via a safe YAML/JSON sniff) and defers validation/dereferencing/normalisation to a worker,
through the same outbox/BullMQ machinery sprint 3 built for check runs:

```
POST .../documents  →  ApiDocument (PENDING) + outbox row ("document.uploaded"), same transaction
                          │
              DocumentOutboxRelay polls every 2s (bypass_rls — no request context)
                          │
                BullMQ job on the document-parsing queue
                          │
         ParseDocumentProcessor → DocumentParseService.execute (bypass_rls)
                          │
   detect format → SpecParserFactory picks a parser → validate + dereference (internal $refs only)
                          │
    normalise to Endpoint rows → carry over previous version's setup → flip status to READY/FAILED
```

This is the **same** transactional-outbox pattern as `applications`' `run.queued` pipeline
(ADR-002), but on its own `kind` (`document.uploaded`) and its own dedicated BullMQ queue
(`document-parsing`) — BullMQ doesn't support two independent `@Processor` classes sharing one
queue name safely (each creates its own competing `Worker`, so jobs would be double-processed or
misrouted). The shared `outbox` table is scoped by `kind`, and each module gets its own relay +
queue: `DocumentOutboxRelay`/`document-parsing` alongside `applications`' existing
`OutboxRelay`/`check-runs`.

## The three formats

One `SpecParser` implementation per format, picked by `SpecParserFactory` (the one place that
knows every concrete parser — the same shape `AuthStrategyFactory` uses):

- **`OpenApi3Parser`** / **`Swagger2Parser`** — `@apidevtools/swagger-parser`'s `validate()`
  (validates against the official JSON Schema *and* the spec's own semantic rules, e.g. every path
  parameter must be declared), which also dereferences internal `$ref`s. External `$ref`s are
  rejected outright (see [07-security.md](../07-security.md)) before validation even runs.
- **`PostmanV21Parser`** — validates against a minimal, self-authored JSON Schema (`ajv`) covering
  only the shape Pulse actually reads, not Postman's full official schema — deliberately, so
  validation stays auditable and offline rather than fetching a schema from Postman's servers.
  Walks `item[]` recursively (folders nest items) into the same normalised shape.

All three normalise to the same `ParsedSpec`: a list of `{ method, path, operationId?,
expectedStatuses?, responseSchema?, sampleParams?, sampleBody? }`, plus the spec's own declared
version string (`openapi`/`swagger`/the Postman schema URL's version segment) — stored as
`ApiDocument.specVersion`, distinct from `versionNo` (Pulse's own per-application upload counter).

## Versioning

- **One active version per application**, enforced by a Postgres partial unique index
  (`api_documents (application_id) WHERE is_active`) rather than a plain unique constraint — the
  latter would also wrongly forbid multiple *inactive* rows, but "at most one active" only needs
  to hold among active rows.
- **A new upload only activates on success.** The just-created document stays `is_active: false`
  through parsing; only once the worker reaches `markReady()` does it deactivate the previous
  active document and activate the new one. A failed re-upload therefore never empties the
  application's live endpoint list.
- **Checksum dedup.** If an upload's SHA-256 matches the current active document's, no new version
  is created — the existing active document is returned as-is.
- **Carry-over.** Once the new version's endpoints are parsed, each one is matched against the
  *previous* active document's endpoints by `(method, path)`; a match copies `included`,
  `sampleParams`, and `sampleBody` (`Endpoint.carryOverFrom`). Write-confirmation fields are left
  untouched — sprint 5 populates them.

## What's not built yet

- Checks against these endpoints (`EndpointHealthCheck`) — sprint 5.
- Write-method confirmation (`POST /endpoints/:id/write-confirmation`, the write-method toggle in
  the UI) — the schema columns exist, nothing sets them yet.
- `allow_in_schedule` enforcement.
- Endpoint grouping "by tag" per the technical plan's literal wording — the data model has no
  `tag` column, so the frontend groups by first path segment instead (a pragmatic stand-in, not a
  schema gap silently papered over).
