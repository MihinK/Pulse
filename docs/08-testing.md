# Testing

Full testing strategy: [technical plan](./02-technical-plan.md), section 8.2.

## Running tests locally

```bash
# everything, via Turborepo
pnpm test:coverage

# one package at a time
pnpm --filter @pulse/shared test:coverage
pnpm --filter @pulse/api test:coverage
pnpm --filter @pulse/web test:coverage

# API integration/API-level e2e tests (boots a real Nest app in-process against a real
# Postgres and Redis via Testcontainers — requires Docker)
pnpm --filter @pulse/api test:e2e
```

## The coverage gate

Every package enforces 90% lines/branches/functions/statements as a hard failure:

- `packages/shared/jest.config.js` and `apps/api/jest.config.js` — Jest's `coverageThreshold`
- `apps/web/vitest.config.ts` — Vitest's `test.coverage.thresholds`

CI (`.github/workflows/ci.yml`) runs `pnpm test:coverage` and fails the build if any package
drops below the threshold. Coverage reports are uploaded as a build artifact on every run.

## What's excluded from coverage, and why

A handful of files are excluded from the coverage calculation because they have no branches or
logic to exercise — including them would pad the denominator without adding a meaningful test:

- `*.module.ts` (NestJS module wiring — declarative DI registration)
- `main.ts` (bootstrap — calling `NestFactory.create` etc.)
- `mikro-orm.config.ts` (CLI/connection config — same rationale as `main.ts`)
- `**/migrations/**` (schema DDL — no business logic; correctness is proven by running them
  against a real Postgres, see [04-data-model.md](./04-data-model.md), not by unit tests)
- `**/*.tokens.ts` (DI token constants)
- `app/layout.tsx`, `app/**/layout.tsx`, `app/page.tsx` (framework wiring / route-segment CSS
  scoping — see [features/applications-and-url-checks.md](./features/applications-and-url-checks.md)
  for why sprint 3's pages have their own `layout.tsx`)
- `components/ui/**` (vendored shadcn/ui primitives — Radix + `class-variance-authority` wiring,
  not hand-written business logic; same rationale as excluding `*.module.ts`)
- `test-support/**` in both `apps/api` and `apps/web` (test-only helpers — a Jest/Vitest
  `moduleNameMapper` mock for ESM-only packages, a `QueryClientProvider` test wrapper — not
  application code)

Everything else — domain objects, application services, infrastructure adapters, controllers,
DTOs with mapping logic, React components — is included and tested. When in doubt, the rule is:
if a file could have a bug, it's in the coverage count.

**Note:** `apps/api/test/*.e2e-spec.ts` (integration and API-level tests, run via `test:e2e`) are
*not* part of the coverage numbers above — `test:coverage` only runs `*.spec.ts` unit tests.
Repository adapters, controllers and DTOs are covered twice, once by unit tests (with fakes/mocks,
counted in the gate) and once by the e2e suite (against a real, RLS-enforcing Postgres, not
counted but exercising the real thing) — see `apps/api/test/tenancy.e2e-spec.ts` (cross-org
isolation) and `apps/api/test/applications-api.e2e-spec.ts` (sprint 3: the same isolation proof
for applications/runs, plus the outbox → BullMQ → worker pipeline end-to-end against a real Redis
and a local fixture HTTP server — never the internet) in particular.

## Test doubles

- **Time**: every class that needs "now" depends on the `Clock` interface from
  `@pulse/shared`. Tests use `FixedClock`, never the real system clock, so duration and
  timestamp assertions are exact and never flaky.
- **Dependencies**: sprint 1's example is `HealthCheckService`, which depends on the
  `DependencyCheck` interface — tests pass in-memory fakes, never a real database or queue.
  Every later module follows the same pattern (see the technical plan's list of interfaces,
  section 4.1).
