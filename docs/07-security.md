# Security

Full context: [technical plan](./02-technical-plan.md) section 8.1, requirements section 3.4,
[ADR-003](./adr/003-multitenancy-row-level-security.md). This page tracks what's actually
implemented: sprint 2's authentication and multi-tenant isolation, sprint 3's SSRF protection and
target-credential encryption, and sprint 4's malicious-spec-file defenses.

## Authentication

- **Passwords**: Argon2id (`Argon2PasswordHasher`, `apps/api/src/modules/identity/infrastructure/argon2-password-hasher.ts`).
- **Access tokens**: signed JWT (HS256), 15 minutes, returned in the response body and held in
  memory by the frontend (`AuthProvider`) — never in `localStorage` or a readable cookie.
- **Refresh tokens**: opaque random values, never JWTs. Only their SHA-256 hash is stored
  (`refresh_tokens.token_hash`). Transported as an `httpOnly`, `SameSite=Lax` cookie scoped to
  `/api/v1/auth`, so no client-side JS can read it and it's never sent to unrelated routes.
- **Rotation**: every `/auth/refresh` call revokes the presented token and issues a new one,
  chained via `refresh_tokens.replaced_by_token_id`. Reusing an already-rotated token (a signal of
  theft) fails with 401 rather than silently succeeding.
- **Login across organisations**: `users` is unique on `(organization_id, email)`, not `email`
  alone, so the same email can hold separate accounts in separate orgs. `AuthService.login` looks
  up every matching row (bypass-scoped — see below) and checks the password against each; in the
  near-certain case of 0 or 1 matches this is just a normal login.
- **Rate limiting**: `POST /auth/login` is throttled (5 attempts/minute) via `@nestjs/throttler`,
  on top of the app-wide default (60 requests/minute).

## Multi-tenant isolation (ADR-003)

PostgreSQL Row-Level Security on every tenant table (`organizations`, `users`, `invitations`,
`refresh_tokens` — see [04-data-model.md](./04-data-model.md#row-level-security-adr-003)),
**in addition to**, not instead of, application-level scoping via path/JWT.

### The bypass, and why it's narrow

RLS policies read two Postgres session variables, set once per request by `TenancyInterceptor`:

| Variable               | Set to                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| `app.current_org_id`    | The authenticated principal's `organizationId` (empty string if none) |
| `app.bypass_rls`        | `true` for the Platform Owner, and for three specific `@Public()` routes |

The three public routes that bypass RLS are exactly the operations that must legitimately cross
the org boundary before one is known:

- `POST /auth/login` — finding a user by email, before their org is known.
- `POST /auth/refresh` / `POST /auth/logout` — looking up a refresh token by its hash.
- `POST /invitations/:token/accept` — looking up an invitation by its token hash, then creating a
  user inside *its* organisation.

Every other route runs with `bypass_rls = false` and `current_org_id` set to the caller's own
org — so even a bug that forgets a `WHERE organization_id = ...` clause cannot leak another
tenant's rows, because Postgres filters them out before the application ever sees them.

### What this looks like at the API

An Admin or Viewer hitting a resource outside their own organisation gets **404, not 403 or an
empty list** — RLS makes the row invisible, so from the application's point of view it simply
doesn't exist. (An earlier version of `GET /organizations/:id/users` returned `200 []` for an
invisible org instead — fixed by having the controller confirm the organisation itself is visible
first.) This is deliberate: 403 would confirm the resource exists but is forbidden, which is
itself a small information leak across tenants.

### The table-owner gotcha

Postgres RLS is bypassed by the table owner and by superusers, unconditionally. The API's runtime
datasource connects as a separate, unprivileged `pulse_app` role
(`NOSUPERUSER NOBYPASSRLS`) created by the RLS migration — never the same role migrations run as.
Getting this wrong is the single most common way to make RLS silently do nothing while every test
still passes (because the connecting role would see every row anyway). The integration test that
proves isolation (`apps/api/test/tenancy.e2e-spec.ts`) deliberately runs migrations as the
superuser and then reconnects as `pulse_app`, so it exercises the real policies.

### Platform Owner bootstrap

The first Platform Owner account (`organization_id = null`) is seeded from
`PLATFORM_OWNER_EMAIL`/`PLATFORM_OWNER_PASSWORD` on boot (`PulseOwnerSeeder`,
`OnApplicationBootstrap`) if none exists yet. This runs outside any HTTP request, so it opens its
own transaction and sets `app.bypass_rls = true` directly, rather than going through
`TenancyInterceptor` (there is no request to intercept).

## Roles

`PLATFORM_OWNER` (spans every org, creates orgs), `ADMIN` (manages their org's users/invitations,
and — sprint 3 — creates/edits applications and configures their auth), `VIEWER` (read-only within
their org, plus triggering a manual check). Enforced by two global guards, in order:

1. `JwtAuthGuard` — every route requires a valid access token unless `@Public()`.
2. `RolesGuard` — no-ops unless a handler carries `@Roles(...)`, in which case it checks the
   principal's role.

## SSRF protection

Every check makes an outbound HTTP request to a URL an Admin supplied (`Application.baseUrl`) —
exactly the shape of request SSRF defenses exist for (requirements section 3.4). Two pieces, each
independently testable:

- **`NetworkPolicy`** (`CloudNetworkPolicy`, `apps/api/src/modules/applications/infrastructure/cloud-network-policy.ts`)
  — a pure function over an *already-resolved* IP: `assertAllowed(ip)` throws for loopback
  (`127.0.0.0/8`, `::1`), RFC 1918 private ranges, link-local (`169.254.0.0/16`, which includes the
  `169.254.169.254` cloud metadata address), carrier-grade NAT, multicast, and reserved ranges.
  Hand-rolled bitwise CIDR checks on Node's built-in `net` module rather than a dependency, so the
  whole policy is auditable in one file.
- **`UndiciHttpProbe`** (`apps/api/src/modules/applications/infrastructure/undici-http-probe.ts`)
  — does the DNS resolution and calls `NetworkPolicy.assertAllowed` on *every* hop, including
  redirects (it never lets undici auto-follow a redirect): a `baseUrl` that resolves to a public IP
  but redirects to `http://169.254.169.254/` is blocked on the second hop, not just the first. This
  is the specific defense against DNS-rebinding-style bypasses — checking only the original
  hostname, once, before the request is sent, would miss it entirely.

A blocked request surfaces as a normal `FAILED` check result (`failure_reason`: "Address ... is not
allowed by network policy"), not a 500 — from the caller's point of view it's just a check that
didn't pass, same as a timeout or a non-2xx response.

## Malicious spec files

An uploaded API document (OpenAPI 3, Swagger 2, or a Postman v2.1 collection) is untrusted input —
the technical plan's threat table (section 8) calls out four specific defenses, all implemented in
`apps/api/src/modules/documents/`:

- **10 MB limit** — enforced twice: `FileInterceptor`'s `limits.fileSize` for multipart uploads
  (rejected by multer before the handler even runs), and a byte-counting abort mid-stream for URL
  imports (`UndiciContentFetcher`, `ContentTooLargeError`) — not just a post-hoc check after the
  whole file has already downloaded.
- **Safe YAML loading** — `js-yaml`'s safe-by-default `load()` (`DefaultSpecFormatDetector`); JSON
  is valid YAML, so one safe parser handles both upload shapes.
- **No external `$ref` in Cloud edition** — `assertNoExternalRefs` (shared by `OpenApi3Parser` and
  `Swagger2Parser`) walks the raw, pre-dereference document for any `$ref` that isn't a
  same-document JSON pointer (`#/...`) and rejects the whole document if it finds one. This runs
  *before* `swagger-parser`'s own `resolve.external: false` option, because that option only
  *ignores* external refs (leaves them unresolved) rather than rejecting the document outright —
  ignoring isn't the same as refusing untrusted external input.
- **Parsing in the worker, with a time limit** — validation/dereferencing/normalisation never runs
  inline in the upload request; it's deferred to `ParseDocumentProcessor` (BullMQ), the same
  outbox-relay pattern as sprint 3's check runs. See
  [features/api-document-upload.md](./features/api-document-upload.md) for the full pipeline.
  (BullMQ's own job-level timeout provides the time limit; a spec that somehow hangs the worker
  fails that one job without blocking the API.)

A document that fails validation for any reason — malformed, an external `$ref`, or a genuine
parse error — is marked `FAILED` with a `failure_reason`, never a 500, and never activated: the
application's previously-active document (if any) stays active and visible.

## Secret encryption

Auth credentials for a target application (`auth_configs.config_encrypted`) are encrypted with
AES-256-GCM (`AesGcmSecretCipher`,
`apps/api/src/modules/applications/infrastructure/aes-gcm-secret-cipher.ts`) before being
persisted — key from `SECRET_ENCRYPTION_KEY` (env var, hashed to exactly 32 bytes so any
passphrase length works, never hardcoded — same pattern as `JWT_ACCESS_SECRET`). Ciphertext layout
is `iv (12 bytes) | authTag (16 bytes) | ciphertext`; a tampered or wrong-key ciphertext fails to
decrypt rather than silently returning garbage, since GCM's auth tag is checked on decrypt.

Credentials are **never returned by any read endpoint** — `ApplicationResponseDto` and
`AuthConfigResponseDto` have no field for them at all (not a redaction rule applied at
serialization time, which could be gotten wrong later) — `GET /applications/:id/auth` returns only
the configured `type`.

## What's still a placeholder

`OAUTH2_CC`/`LOGIN_FLOW` auth (the enum values and `token_cache_encrypted` column exist; no
`AuthStrategy` implementation until sprint 5), and the OWASP Top 10 pre-release checklist
(technical plan section 8.1) — tracked as a full pass once the write path (write-method
confirmation, sprint 5) exists to review.
