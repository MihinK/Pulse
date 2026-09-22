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

# API end-to-end tests (boots a real Nest app in-process)
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
- `**/*.tokens.ts` (DI token constants)
- `app/layout.tsx`, `app/page.tsx` (framework wiring / not-yet-built placeholder page)

Everything else — domain objects, application services, infrastructure adapters, controllers,
DTOs with mapping logic, React components — is included and tested. When in doubt, the rule is:
if a file could have a bug, it's in the coverage count.

## Test doubles

- **Time**: every class that needs "now" depends on the `Clock` interface from
  `@pulse/shared`. Tests use `FixedClock`, never the real system clock, so duration and
  timestamp assertions are exact and never flaky.
- **Dependencies**: sprint 1's example is `HealthCheckService`, which depends on the
  `DependencyCheck` interface — tests pass in-memory fakes, never a real database or queue.
  Every later module follows the same pattern (see the technical plan's list of interfaces,
  section 4.1).
