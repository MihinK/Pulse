# Architecture (sprint 1 snapshot)

Full architecture detail lives in the [technical plan](./02-technical-plan.md), section 2. This
page tracks what sprint 1 actually built.

## Repository layout

```
pulse/
├── apps/
│   ├── api/          # NestJS API — currently just the health module
│   └── web/          # Next.js frontend — currently a placeholder page
├── packages/
│   └── shared/        # Clock, Formatter, shared enums — used by both apps
├── docs/               # this folder
├── docker-compose.yml   # Postgres, Redis, MinIO, Mailpit
└── .github/workflows/ci.yml
```

## The health module, as a worked example of the layering

Every module in `apps/api` follows the same four-layer structure, demonstrated here on the one
module sprint 1 built:

```
apps/api/src/modules/health/
├── domain/           # HealthStatus — no NestJS or database imports
├── application/       # HealthCheckService, DependencyCheck (Strategy interface)
├── infrastructure/    # DatabaseDependencyCheck (placeholder until sprint 2)
└── presentation/       # HealthController, HealthResponseDto
```

- **Domain** has no framework imports, so it is unit tested directly with no mocking.
- **Application** depends on the `DependencyCheck` interface, not on any concrete dependency —
  new dependencies (queue, object storage) are added as new classes in `infrastructure/`,
  without changing `HealthCheckService` (Open/Closed).
- **Presentation** maps the domain object to the wire format and sets the HTTP status
  (200 vs 503) based on it.

Every future module (applications, specs, checks, reports) will follow this same shape — see
the technical plan section 4.1 for the full list of interfaces this pattern will carry.

## What's still a placeholder

`DatabaseDependencyCheck` always reports UP — there's no real database connection yet. It's
already behind the `DependencyCheck` interface so the real MikroORM-backed check (sprint 2)
drops in without touching `HealthCheckService` or its tests.
