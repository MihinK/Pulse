# Applications and URL checks

Sprint 3. Register an application, run a URL health check against it (manually, for now), and see
UP/DEGRADED/DOWN with a response time. Full detail: [04-data-model.md](../04-data-model.md),
[07-security.md](../07-security.md), [03-architecture.md](../03-architecture.md).

## Roles

Same three roles as identity ([identity-and-tenancy.md](./identity-and-tenancy.md#roles)). Within
an organisation: Admin can create/edit/delete applications and configure auth; Admin and Viewer
can both list, view, and trigger a manual check ("Check now").

## Flows

**Add an application** — `POST /applications` (Admin only) — `/applications/new` in the web app.
In one transaction (ADR-002): creates the `Application`, a default `NONE` auth config, a `QUEUED`
`CheckRun` + its outbox entry (the first check, FR-APP-06), and an `AuditLog` entry.

**List / filter** — `GET /applications?status=&environment=&search=` (Admin or Viewer) —
`/applications`.

**View / edit** — `GET`/`PATCH /applications/:id` (view: Admin or Viewer; edit: Admin only) —
`/applications/:id`, `/applications/:id/edit`.

**Configure auth** — `GET`/`PUT /applications/:id/auth` (view: Admin or Viewer, credentials never
included in the response; set: Admin only). Supports `NONE`, `API_KEY` (header or query),
`BEARER`, `BASIC` this sprint — `OAUTH2_CC`/`LOGIN_FLOW` are valid `auth_configs.type` values in
the schema already, but have no `AuthStrategy` yet (sprint 5) and are rejected by
`AuthConfigService` if requested.

**Check now** — `POST /applications/:id/runs` (Admin or Viewer) — same transactional-outbox path
as the first check. Redirects to `/runs/:id`, which polls `GET /runs/:id` (TanStack Query
`refetchInterval`, not SSE — that's sprint 5) until the run leaves `QUEUED`/`RUNNING`, then shows
the summary and `GET /runs/:id/results`.

## How a check actually runs

```
POST .../runs  →  CheckRun (QUEUED) + outbox row, same DB transaction
                          │
              OutboxRelay polls every 2s (bypass_rls — no request context)
                          │
                    BullMQ job "run.queued" on the check-runs queue
                          │
                RunCheckProcessor → RunCheckService.execute (bypass_rls)
                          │
        resolve AuthConfig → AuthStrategy.apply → UndiciHttpProbe.probe
                          │
     evaluate outcome → write CheckResult + CheckRun summary + Application.status
```

This is ADR-002's transactional outbox: the outbox row is written in the *same* transaction as the
`CheckRun`, so a job is never enqueued for a run that got rolled back, and nothing but
`OutboxRelay` ever talks to Redis directly.

**Outcome evaluation** (`RunCheckService`): a response is `FAILED` if the probe errored (timeout,
DNS failure, blocked by network policy) or the status code isn't expected; `DEGRADED` if it's
slower than `slowThresholdMs` (default 2000ms); otherwise `PASSED`. `Application.status` is
`DOWN` if the run had any `FAILED` result, else `DEGRADED` if any result was slow, else `UP`.
`expectedStatuses` defaults to `null`, meaning "any 2xx/3xx" — set it to an explicit array to
require exact status codes instead.

## SSRF protection

Every outbound probe re-resolves DNS and checks the resolved IP against `NetworkPolicy` — on the
first request *and* on every redirect hop, so a redirect can't be used to reach a blocked address
that DNS resolution alone wouldn't have caught. Full detail:
[07-security.md](../07-security.md#ssrf-protection).

## What's not built yet

- Endpoint checks (sprint 5's API documents) — this sprint only checks the application's
  `baseUrl` itself, not a set of documented endpoints.
- `OAUTH2_CC`/`LOGIN_FLOW` auth strategies, and the "Test login" affordance.
- Write-method confirmation (sprint 5).
- Scheduled execution — `checkIntervalMinutes` is stored but nothing acts on it yet (sprint 7).
- Report generation off a completed run (sprint 6) — the technical plan's flow enqueues a report
  job after a run completes; there's no consumer for that outbox kind yet, so it isn't written.
- An audit-log viewer UI (the write happens on application create; nothing reads it back yet).
