# ADR-001: NestJS + Next.js TypeScript monorepo

**Status:** Accepted (sprint 1)

## Context

Pulse needs a backend that can enforce SOLID and OOP structure without fighting the framework,
a background worker for check runs, and a frontend for the dashboard and reports. The
requirements doc (section 4) also compares Java/Spring Boot and .NET as alternatives.

## Decision

Single TypeScript monorepo (pnpm workspaces + Turborepo): NestJS for the API and worker,
Next.js for the frontend, a shared `@pulse/shared` package for code both sides need (the
`Clock` abstraction, the `Formatter`, shared enums/types).

## Why

- NestJS's module system and built-in DI container make constructor injection, interfaces and
  layered architecture the path of least resistance — Dependency Inversion happens because
  it's the natural way to write a Nest provider, not because of extra discipline.
- One language end to end means one test runner family (Jest/Vitest), one lint config, and
  request/response DTOs that the frontend can import directly instead of hand-maintaining a
  second copy.
- pnpm workspaces + Turborepo give per-package builds, tests and caching without a second build
  tool.

## Alternatives considered

- **Java 21 + Spring Boot 3**: the most mature OOP/transaction ecosystem and an official
  swagger-parser, but a second language across frontend/backend and heavier iteration.
- **.NET 8 + ASP.NET Core**: same two-language cost as Java.

Both remain valid if requirements change (e.g. an existing Java/.NET team joins) — the layered
architecture and interfaces in the technical plan aren't TypeScript-specific.

## Consequences

- Every module must follow the domain/application/infrastructure/presentation layering from
  day one (established in sprint 1's health module) — retrofitting it later would mean
  reworking already-shipped modules.
- The 90% coverage gate is enforced per-package (`packages/shared`, `apps/api`, `apps/web`)
  rather than repo-wide, so a weak spot in one package can't hide behind strong coverage in
  another.
