# Architecture (sprint 2 snapshot)

Full architecture detail lives in the [technical plan](./02-technical-plan.md), section 2. This
page tracks what's actually built so far.

## Repository layout

```
pulse/
├── apps/
│   ├── api/          # NestJS API — health module + identity/tenancy (sprint 2)
│   └── web/          # Next.js frontend — auth pages, platform admin, org people (sprint 2)
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

## What's still a placeholder

Everything not yet listed above — applications, API documents, the check engine, reports,
scheduling, alerts — lands sprint 3 onward per the [technical plan's sprint plan](./02-technical-plan.md#9-sprint-plan).
