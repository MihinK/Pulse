# Identity and tenancy

Sprint 2. Organisations, users, invitations, JWT auth, roles, and Row-Level Security. Full detail:
[04-data-model.md](../04-data-model.md), [07-security.md](../07-security.md),
[ADR-002](../adr/002-mikroorm-unit-of-work.md), [ADR-003](../adr/003-multitenancy-row-level-security.md).

## Roles

| Role             | Scope            | Created by                                              |
| ---------------- | ---------------- | ---------------------------------------------------------- |
| `PLATFORM_OWNER` | Every org         | Seeded from env vars on first boot (`PulseOwnerSeeder`)    |
| `ADMIN`          | One org           | Invited by an Admin or the Platform Owner                  |
| `VIEWER`         | One org, read-only | Invited by an Admin or the Platform Owner                |

## Flows

**Platform Owner creates an organisation** — `POST /organizations` (Platform Owner only) —
`/admin/organizations` in the web app.

**Inviting someone** — `POST /organizations/:orgId/invitations` (Admin or Platform Owner). No
email is sent this sprint (that's the `Notifier` interface planned for sprint 7) — the response
includes a `link` field with the raw invite token; the inviting admin copies and shares it
directly. Shown on `/organization/users` under "Share this link with them."

**Accepting an invitation** — `POST /invitations/:token/accept` (public — the token itself is the
credential), body `{ password }`. Creates the user inside the invitation's organisation and logs
them in immediately (same response shape as `/auth/login`). Web app: `/accept-invite/[token]`.

**Login / refresh / logout** — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. See
[07-security.md](../07-security.md#authentication) for the token model.

**Profile** — `GET`/`PATCH /users/me`. Only `timeZone` is self-editable; email and role are not.
Web app: `/profile`.

**Suspending an organisation** — `PATCH /organizations/:id` (Platform Owner only), body
`{ active: false }`. A suspended org's users can still log in — sprint 2 doesn't block their
sessions — but the org no longer appears anywhere account-status matters (report generation,
future billing). Blocking active sessions on suspension, if wanted, is a later decision.

## Cross-tenant isolation, in practice

An Admin or Viewer can only ever see their own organisation's rows — enforced by Postgres RLS, not
just application code (see [07-security.md](../07-security.md#multi-tenant-isolation-adr-003)).
Concretely: `GET /organizations/:id`, `GET /organizations/:id/users`, and
`GET /organizations/:id/invitations` all return **404** for any organisation other than the
caller's own, whether or not that id actually exists. `apps/api/test/tenancy.e2e-spec.ts` proves
this against a real Postgres, with the API connected as the same unprivileged role it uses in
production.

## What's not built yet

- Inviting someone the `Notifier`/email way (sprint 7).
- An org switcher for a user who holds accounts in more than one organisation — `login` finds the
  right account by trying each match, but there's no UI for a user who wants to hold two sessions
  at once.
- Revoking a user's own sessions (only refresh-token rotation exists, not a "sign out everywhere"
  affordance).
