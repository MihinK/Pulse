# Architecture (sprint 4 snapshot)

Full architecture detail lives in the [technical plan](./02-technical-plan.md), section 2. This
page tracks what's actually built so far.

## Repository layout

```
pulse/
├── apps/
│   ├── api/          # NestJS API + worker (in-process) — health, identity/tenancy, applications/checks, API documents
│   └── web/          # Next.js frontend — auth pages, platform admin, org people, applications/runs/documents/endpoints
├── packages/
│   └── shared/        # Clock, Formatter, shared enums — used by both apps
├── docs/               # this folder
├── docker-compose.yml   # Postgres, Redis, MinIO, Mailpit
└── .github/workflows/ci.yml
```

## The health module, as a worked example of the layering

Every module in `apps/api` follows the same four-layer structure, demonstrated here on the
smallest module (sprint 1) and carried through by the identity module (sprint 2, see below):

```
apps/api/src/modules/health/
├── domain/           # HealthStatus — no NestJS or database imports
├── application/       # HealthCheckService, DependencyCheck (Strategy interface)
├── infrastructure/    # DatabaseDependencyCheck — now a real `select 1` (sprint 2)
└── presentation/       # HealthController, HealthResponseDto
```

- **Domain** has no framework imports, so it is unit tested directly with no mocking.
- **Application** depends on the `DependencyCheck` interface, not on any concrete dependency —
  new dependencies (queue, object storage) are added as new classes in `infrastructure/`,
  without changing `HealthCheckService` (Open/Closed).
- **Presentation** maps the domain object to the wire format and sets the HTTP status
  (200 vs 503) based on it.

## The identity module (sprint 2)

`apps/api/src/modules/identity/` follows the same four layers, at a larger scale — full detail in
[04-data-model.md](./04-data-model.md), [07-security.md](./07-security.md), and
[features/identity-and-tenancy.md](./features/identity-and-tenancy.md):

```
apps/api/src/modules/identity/
├── domain/           # Organization, User, Invitation, RefreshToken (MikroORM entities with behaviour — ADR-002)
├── application/       # AuthService, InvitationService, OrganizationService, ProfileService, and their ports/
├── infrastructure/    # MikroORM repository adapters, Argon2PasswordHasher, JwtTokenService, PulseOwnerSeeder
└── presentation/       # AuthController, OrganizationsController, InvitationsController, UsersController
```

Two cross-cutting pieces live outside this module, in `apps/api/src/common/auth/`, because every
future module (applications, checks, reports) will need them too: `JwtAuthGuard` and `RolesGuard`
(both registered globally), and `TenancyInterceptor` (the Row-Level-Security session-variable
wrapper, applied per-controller — see [07-security.md](./07-security.md)).

## The applications module (sprint 3)

`apps/api/src/modules/applications/` — full detail in [04-data-model.md](./04-data-model.md),
[07-security.md](./07-security.md), and
[features/applications-and-url-checks.md](./features/applications-and-url-checks.md):

```
apps/api/src/modules/applications/
├── domain/           # Application, AuthConfig, CheckRun, CheckResult, OutboxEntry, AuditLog (MikroORM entities — ADR-002)
├── application/       # ApplicationService, AuthConfigService, RunService, RunCheckService, and their ports/
├── infrastructure/    # AesGcmSecretCipher, CloudNetworkPolicy, UndiciHttpProbe, auth strategies, BullMqQueue, OutboxRelay, RunCheckProcessor, MikroORM repo adapters
└── presentation/       # ApplicationsController, ApplicationRunsController, RunsController
```

The one architectural piece this module adds that identity didn't need: a **worker**, running
in-process alongside the API rather than as a separate deployable (technical plan section 2.3
allows either; the whole check workload is light enough this sprint that a separate process would
be premature). `OutboxRelay` (an `@Interval` poller) and `RunCheckProcessor` (a BullMQ
`@Processor`) both run inside the same Nest application as every controller — see
[04-data-model.md](./04-data-model.md#row-level-security-adr-003) for how they get RLS-safe
database access despite having no HTTP request to hang a `TenancyInterceptor` off.

`ApplicationService`/`AuthConfigService`/`RunService`/`RunCheckService` depend only on ports
(`ApplicationRepository`, `SecretCipher`, `NetworkPolicy`, `HttpProbe`, `Queue`, `AuthStrategy`) —
never on MikroORM, undici, or BullMQ directly. A new auth strategy or a new report exporter later
is a new `infrastructure/` class registered in `applications.module.ts`, not a change to any of
those four services (Open/Closed) — the exact same shape the [health module](#the-health-module-as-a-worked-example-of-the-layering)
demonstrates at a smaller scale.

## The documents module (sprint 4)

`apps/api/src/modules/documents/` — full detail in [04-data-model.md](./04-data-model.md),
[07-security.md](./07-security.md), and
[features/api-document-upload.md](./features/api-document-upload.md):

```
apps/api/src/modules/documents/
├── domain/           # ApiDocument, Endpoint (MikroORM entities with behaviour — ADR-002)
├── application/       # DocumentService, EndpointService, DocumentParseService, and their ports/
├── infrastructure/    # DefaultSpecFormatDetector, OpenApi3Parser/Swagger2Parser/PostmanV21Parser, SpecParserFactory, S3CompatibleStorage, UndiciContentFetcher, BullMqDocumentQueue, DocumentOutboxRelay, ParseDocumentProcessor, MikroORM repo adapters
└── presentation/       # DocumentsController, DocumentEndpointsController, EndpointsController
```

Imports `ApplicationsModule` and `IdentityModule` rather than duplicating anything they already
provide: `ApplicationService` (the "confirm the parent is visible" 404-not-403 pattern),
`OUTBOX_REPOSITORY` (the same shared `outbox` table applications' pipeline uses, ADR-002),
`NETWORK_POLICY` (reused as-is for the URL-import SSRF defense), and `ProfileService`. It brings
its own BullMQ queue (`document-parsing`) and its own `@Interval` outbox relay
(`DocumentOutboxRelay`) rather than sharing `applications`' `check-runs` queue — BullMQ doesn't
support two independent `@Processor` classes safely sharing one queue name, so the shared `outbox`
table is scoped by `kind` (`"run.queued"` vs `"document.uploaded"`) and each module relays its own
kind to its own queue.

`SpecParserFactory` is infrastructure, not application — the same reason `AuthStrategyFactory` is:
it's the one place allowed to know every concrete `SpecParser` implementation, so a fourth spec
format later is a new parser class registered there, not a change to `DocumentParseService`
(Open/Closed).

## What's still a placeholder

Endpoint checks (running a check against a parsed endpoint, not just an application's `baseUrl`),
`OAUTH2_CC`/`LOGIN_FLOW` auth, write-method confirmation, scheduled execution, reports, alerts —
lands sprint 5 onward per the
[technical plan's sprint plan](./02-technical-plan.md#9-sprint-plan).
