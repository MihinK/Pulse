# Data model

Full schema context lives in the [technical plan](./02-technical-plan.md), section 3. This page
tracks what's actually implemented: sprint 2's identity/tenancy tables, and sprint 3's
applications/checks tables.

## Conventions

Every table follows the same pattern (technical plan section 3): UUID v7 primary keys,
`created_at`/`updated_at` as `timestamptz` in UTC, and a `version` integer for optimistic locking
on editable rows (enforced by MikroORM's native `@Property({ version: true })`, not hand-rolled).

## Tables (sprint 2: identity and tenancy)

### `organizations`

The tenant root — every other tenant table carries `organization_id`.

| Column               | Type                  | Notes                                       |
| -------------------- | --------------------- | -------------------------------------------- |
| `id`                 | uuid, PK               |                                               |
| `name`                | text                   |                                               |
| `slug`                | text, unique           | URL-safe, lowercase                          |
| `status`              | varchar(20)            | `ACTIVE` \| `SUSPENDED`                      |
| `edition`             | varchar(20)            | `CLOUD` \| `PRIVATE` (Private lands sprint 8) |
| `default_time_zone`   | text                   | IANA name                                    |
| `created_at`/`updated_at`/`version` | —       | see Conventions                              |

### `users`

| Column            | Type       | Notes                                                                 |
| ----------------- | ---------- | ---------------------------------------------------------------------- |
| `id`              | uuid, PK    |                                                                        |
| `organization_id` | uuid, null  | **Null only for the Platform Owner.** FK to `organizations`.          |
| `email`           | text        | Unique on `(organization_id, email)`, **not** on email alone.         |
| `password_hash`   | text        | Argon2id.                                                             |
| `role`            | varchar(20) | `PLATFORM_OWNER` \| `ADMIN` \| `VIEWER`                                |
| `time_zone`       | text        | IANA name, default `UTC`.                                             |

`(organization_id, email)` rather than a global unique on `email` is deliberate: the same email
can hold separate accounts in separate organisations (a contractor working two client orgs, for
example). `AuthService.login` accounts for this — see [07-security.md](./07-security.md).

### `invitations`

| Column            | Type        | Notes                                             |
| ----------------- | ----------- | -------------------------------------------------- |
| `id`              | uuid, PK     |                                                    |
| `organization_id` | uuid         | FK to `organizations`, not null.                  |
| `email`           | text         |                                                    |
| `role`            | varchar(20)  | Invite-time role; the DTO restricts this to `ADMIN`/`VIEWER` — a Platform Owner is never invited, only seeded (see below). |
| `token_hash`      | text, unique | SHA-256 of the opaque invite token; the raw token is never stored. |
| `expires_at`      | timestamptz  | Default 7 days.                                    |
| `accepted_at`     | timestamptz, null |                                               |
| `invited_by`      | uuid         | FK to `users`.                                     |

### `refresh_tokens`

Not in the technical plan's original data model table — added here because it predates the
"rotating refresh tokens" requirement (technical plan section 8.1). Not itself a tenant table (no
`organization_id`); scoped transitively through `user_id` for RLS purposes.

| Column                  | Type        | Notes                                                        |
| ----------------------- | ----------- | -------------------------------------------------------------- |
| `id`                    | uuid, PK     |                                                                |
| `user_id`               | uuid         | FK to `users`.                                                 |
| `token_hash`            | text, unique | SHA-256 of the opaque refresh token; the raw value is never stored. |
| `expires_at`            | timestamptz  |                                                                |
| `revoked_at`            | timestamptz, null |                                                           |
| `replaced_by_token_id`  | uuid, null   | Chains to the token that replaced it on rotation.              |

## Tables (sprint 3: applications and checks)

### `applications`

| Column                   | Type          | Notes                                                        |
| ------------------------ | ------------- | -------------------------------------------------------------- |
| `id`                     | uuid, PK       |                                                                |
| `organization_id`        | uuid           | FK to `organizations`, not null.                               |
| `name`, `base_url`       | text           |                                                                |
| `environment`            | varchar(20)    | `DEV` \| `STAGING` \| `PROD`                                  |
| `description`            | text, null     |                                                                |
| `tags`                   | text[]         |                                                                |
| `check_interval_minutes` | int            | Default 5. Stored, not yet acted on (scheduling is sprint 7). |
| `timeout_ms`             | int            | Default 10000.                                                |
| `slow_threshold_ms`      | int            | Default 2000 — above this, a passing check is `DEGRADED`.     |
| `expected_statuses`      | int[], null    | `null` means "any 2xx/3xx" (FR-HC-03's default); a populated array means exact match only. |
| `schema_validation`      | boolean        | Default false. Unused until sprint 5's API documents.         |
| `status`                 | varchar(20)    | `UP` \| `DEGRADED` \| `DOWN` \| `UNKNOWN` — the aggregate health from the most recent completed run. |
| `deleted_at`             | timestamptz, null | Soft delete (FR-APP-03).                                    |
| `created_at`/`updated_at`/`version` | —   | see Conventions                                                |

### `auth_configs`

One-to-one with `applications`. Credentials are never returned by any read endpoint — matches the
technical plan's data model exactly, so no `organization_id` column; RLS scopes it transitively
through `applications` (see below).

| Column                   | Type        | Notes                                                              |
| ------------------------ | ----------- | --------------------------------------------------------------------- |
| `id`                     | uuid, PK     |                                                                     |
| `application_id`         | uuid, unique | FK to `applications`.                                              |
| `type`                   | varchar(20)  | `NONE` \| `API_KEY` \| `BEARER` \| `BASIC` \| `OAUTH2_CC` \| `LOGIN_FLOW` — only the first four have a strategy class this sprint. |
| `config_encrypted`       | bytea, null  | AES-256-GCM ciphertext (`AesGcmSecretCipher`) — see [07-security.md](./07-security.md#secret-encryption). `null` only for `NONE`. |
| `token_cache_encrypted`, `token_expires_at` | —, null | For `OAUTH2_CC`/`LOGIN_FLOW` token caching — unused until sprint 5, included now so that sprint needs no schema migration. |
| `created_at`/`updated_at`/`version` | —   | see Conventions                                                    |

### `check_runs`

| Column            | Type          | Notes                                                              |
| ----------------- | ------------- | ---------------------------------------------------------------------- |
| `id`              | uuid, PK       |                                                                     |
| `organization_id` | uuid           | FK to `organizations`, not null.                                   |
| `application_id`  | uuid           | FK to `applications`, not null.                                   |
| `api_document_id` | uuid, null     | Column exists per the full data model, unused until sprint 5.      |
| `trigger`         | varchar(20)    | `MANUAL` \| `SCHEDULED` — only `MANUAL` is produced this sprint.   |
| `triggered_by`    | uuid, null     | FK to `users`; null for a (future) scheduled run.                  |
| `status`          | varchar(20)    | `QUEUED` \| `RUNNING` \| `COMPLETED` \| `FAILED` \| `CANCELLED`.    |
| `started_at`, `finished_at` | timestamptz, null | —                                                        |
| `total`, `passed`, `failed`, `skipped` | int  | Summary counts. A `DEGRADED` result counts toward `passed` (it succeeded, just slowly) — `DEGRADED`-ness is only visible per-result, not aggregated at the run level. |
| `avg_ms`, `p95_ms` | numeric, null | —                                                                   |
| `created_at`/`updated_at`/`version` | —   | see Conventions                                                     |

### `check_results`

No `organization_id`/`version`/`updated_at` columns — matches the technical plan's data model
exactly; RLS scopes this table transitively through `check_runs`.

| Column           | Type          | Notes                                                             |
| ---------------- | ------------- | --------------------------------------------------------------------- |
| `id`             | uuid, PK       |                                                                    |
| `check_run_id`   | uuid           | FK to `check_runs`, not null.                                     |
| `endpoint_id`    | uuid, null     | Column exists per the full data model, unused until sprint 5.     |
| `method`         | varchar(10)    | Default `GET`.                                                    |
| `url`            | text           |                                                                    |
| `status_code`, `response_ms` | int, null | Absent when the probe never got a response at all.          |
| `outcome`        | varchar(20)    | `PASSED` \| `FAILED` \| `DEGRADED` \| `SKIPPED`.                   |
| `failure_reason` | text, null     | E.g. "Unexpected status 500", or a network-policy/timeout message. |
| `checked_at`     | timestamptz    |                                                                    |

### `outbox`

ADR-002's transactional outbox — a row is written in the same DB transaction as the business
change it announces, so a queue job is never enqueued for a change that got rolled back.
`OutboxRelay` is the only thing that ever reads unprocessed rows.

| Column            | Type         | Notes                                            |
| ----------------- | ------------ | --------------------------------------------------- |
| `id`              | uuid, PK      |                                                    |
| `organization_id` | uuid          | FK to `organizations`, not null.                  |
| `kind`            | text          | `"run.queued"` this sprint.                       |
| `payload`         | jsonb         | E.g. `{ "checkRunId": "..." }`.                    |
| `created_at`      | timestamptz   |                                                    |
| `processed_at`    | timestamptz, null | Set once `OutboxRelay` has forwarded it to BullMQ. |

### `audit_logs`

Append-only. This sprint writes one row on application create; there is no viewer UI for it yet.

| Column            | Type        | Notes                                    |
| ----------------- | ----------- | ------------------------------------------- |
| `id`              | uuid, PK     |                                            |
| `organization_id` | uuid         | FK to `organizations`, not null.          |
| `actor_id`        | uuid         | FK to `users`, not null.                  |
| `action`          | text         | E.g. `"application.created"`.             |
| `entity_type`, `entity_id` | text, uuid |                                     |
| `before`, `after` | jsonb, null  | Snapshots, where relevant.                |
| `at`              | timestamptz  |                                            |

## Row-Level Security (ADR-003)

Every table above has RLS enabled. Tables that carry `organization_id` directly
(`organizations`, `users`, `invitations`, `applications`, `check_runs`, `outbox`, `audit_logs`)
get the same `tenant_isolation` policy:

```sql
USING (
  current_setting('app.bypass_rls', true) = 'true'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
)
```

Tables with no `organization_id` column of their own (`refresh_tokens`, `auth_configs`,
`check_results`) scope transitively instead — `refresh_tokens` through `users` on `user_id`,
`auth_configs` through `applications` on `application_id`, `check_results` through `check_runs`
on `check_run_id`:

```sql
USING (
  current_setting('app.bypass_rls', true) = 'true'
  OR EXISTS (
    SELECT 1 FROM "check_runs" cr
    WHERE cr."id" = "check_results"."check_run_id"
      AND cr."organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
)
```

Both session variables are set once per request by `TenancyInterceptor`
(`apps/api/src/common/auth/tenancy.interceptor.ts`), inside the transaction
`em.transactional()` opens for that request:

- `app.current_org_id` — the authenticated principal's organisation.
- `app.bypass_rls` — `true` for the Platform Owner (who legitimately spans every org) and for the
  handful of `@Public()` routes that must cross the org boundary before one is known (finding a
  user by email at login; redeeming an invitation token). Every other request is denied by
  default — if a query somehow reaches Postgres outside this interceptor, both variables are
  unset and the policy denies it. `OutboxRelay` and `RunCheckProcessor` (sprint 3) run outside any
  HTTP request — no org context to scope to — so they open their own transaction and set
  `app.bypass_rls = true` directly, the same way `PulseOwnerSeeder` already did.

**The table-owner gotcha:** Postgres RLS policies are bypassed by the table owner and by
superusers, regardless of policy. The API's runtime connection therefore uses a separate,
unprivileged `pulse_app` role (`NOSUPERUSER NOBYPASSRLS`, created by the RLS migration) — never
the same role migrations run as. Connecting the app as the migration/superuser role would make
every policy above a silent no-op.

## Migrations

`apps/api/src/migrations/`:

1. `Migration20260923000001_CreateIdentityTables` — the four identity/tenancy tables.
2. `Migration20260923000002_EnableRowLevelSecurity` — creates the `pulse_app` role, grants it
   `SELECT/INSERT/UPDATE/DELETE` (no DDL), enables RLS, and creates the policies for those tables.
3. `Migration20260923000003_CreateApplicationTables` — the six applications/checks tables.
4. `Migration20260923000004_EnableApplicationRowLevelSecurity` — grants `pulse_app` access and
   creates the policies for those six tables (the role itself already exists from migration 2).

Run with `pnpm --filter @pulse/api migration:up` (reads `DB_MIGRATION_USER`/`DB_MIGRATION_PASSWORD`
from the environment — the superuser, default `pulse`/matches `docker-compose.yml`). The running
API itself connects with `DB_USER`/`DB_PASSWORD` (default `pulse_app`), never the migration
credentials.
