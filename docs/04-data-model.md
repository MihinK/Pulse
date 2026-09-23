# Data model

Full schema context lives in the [technical plan](./02-technical-plan.md), section 3. This page
tracks what's actually implemented, starting with sprint 2's identity/tenancy tables.

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

## Row-Level Security (ADR-003)

Every table above has RLS enabled, with one `tenant_isolation` policy each:

```sql
USING (
  current_setting('app.bypass_rls', true) = 'true'
  OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
)
```

(`refresh_tokens` has no `organization_id` column, so its policy joins through `users` on
`user_id` instead.)

Both session variables are set once per request by `TenancyInterceptor`
(`apps/api/src/common/auth/tenancy.interceptor.ts`), inside the transaction
`em.transactional()` opens for that request:

- `app.current_org_id` — the authenticated principal's organisation.
- `app.bypass_rls` — `true` for the Platform Owner (who legitimately spans every org) and for the
  handful of `@Public()` routes that must cross the org boundary before one is known (finding a
  user by email at login; redeeming an invitation token). Every other request is denied by
  default — if a query somehow reaches Postgres outside this interceptor, both variables are
  unset and the policy denies it.

**The table-owner gotcha:** Postgres RLS policies are bypassed by the table owner and by
superusers, regardless of policy. The API's runtime connection therefore uses a separate,
unprivileged `pulse_app` role (`NOSUPERUSER NOBYPASSRLS`, created by the RLS migration) — never
the same role migrations run as. Connecting the app as the migration/superuser role would make
every policy above a silent no-op.

## Migrations

`apps/api/src/migrations/`:

1. `Migration20260923000001_CreateIdentityTables` — the four tables above.
2. `Migration20260923000002_EnableRowLevelSecurity` — creates the `pulse_app` role, grants it
   `SELECT/INSERT/UPDATE/DELETE` (no DDL), enables RLS, and creates the policies.

Run with `pnpm --filter @pulse/api migration:up` (reads `DB_MIGRATION_USER`/`DB_MIGRATION_PASSWORD`
from the environment — the superuser, default `pulse`/matches `docker-compose.yml`). The running
API itself connects with `DB_USER`/`DB_PASSWORD` (default `pulse_app`), never the migration
credentials.
