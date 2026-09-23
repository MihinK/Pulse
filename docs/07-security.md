# Security

Full context: [technical plan](./02-technical-plan.md) section 8.1, requirements section 3.4,
[ADR-003](./adr/003-multitenancy-row-level-security.md). This page tracks what sprint 2 actually
implemented: authentication, and multi-tenant isolation. SSRF protection and target-credential
encryption land with the check engine (sprint 3+).

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

`PLATFORM_OWNER` (spans every org, creates orgs), `ADMIN` (manages their org's users/invitations),
`VIEWER` (read-only within their org). Enforced by two global guards, in order:

1. `JwtAuthGuard` — every route requires a valid access token unless `@Public()`.
2. `RolesGuard` — no-ops unless a handler carries `@Roles(...)`, in which case it checks the
   principal's role.

## What's still a placeholder

SSRF protection (`NetworkPolicy`), target-credential encryption (`SecretCipher`), and the OWASP
Top 10 pre-release checklist all land with the check engine and secrets storage (sprint 3+) —
this sprint has no code that makes outbound requests to user-supplied URLs yet.
