# ADR-003: Row-Level Security for multi-tenant isolation

**Status:** Accepted (sprint 1, implementation lands sprint 2)

## Context

Pulse moved from a single-organisation assumption to multi-tenant (multiple organisations, each
with Admins and Viewers) during requirements review. Every tenant table needs to guarantee one
organisation's data is never returned to, or overwritten by, another's — and that guarantee
needs to hold even if a future query forgets a `WHERE organization_id = ...` clause.

## Decision

PostgreSQL Row-Level Security (RLS) policies on every tenant table, keyed off a session
variable set from the authenticated user's JWT at the start of each request, in addition to
(not instead of) application-level scoping.

## Why

- RLS enforces isolation in the database itself. An application bug — a missing `where` clause,
  a copy-pasted query, a raw SQL escape hatch — still can't leak another tenant's rows, because
  Postgres filters them out before the application ever sees them.
- It composes with MikroORM's Unit of Work (ADR-002) without special-casing: the session
  variable is set once per request/transaction, and every query inside it is automatically
  scoped.
- It's testable directly: the plan for sprint 2 (technical plan, section 8.2, "Integration")
  includes an explicit test that tries cross-tenant access and asserts a 404, run against a real
  PostgreSQL via Testcontainers.

## Alternatives considered

- **Application-level scoping only** (a base repository that always adds
  `where organization_id = ...`): simpler to implement, but the guarantee lives entirely in
  application code that every future query must remember to use — exactly the class of bug RLS
  is designed to make structurally impossible.
- **Separate database per tenant**: the strongest isolation, but operationally heavy at the
  requirements doc's stated scale (up to 100 applications per org, ~10 orgs on one Cloud node
  initially) and complicates cross-org platform-owner operations (ADR-004's Private edition
  licensing).

## Consequences

- Every tenant table carries `organization_id` and an RLS policy (data model, technical plan
  section 3).
- The API must set the Postgres session variable from the JWT at the start of every
  request/transaction — this becomes a NestJS interceptor or middleware in sprint 2, and its own
  test coverage.
- Platform Owner operations (creating organisations, cross-org admin) need an explicit bypass
  path, which must itself be narrowly scoped and audited — not a blanket "superuser" role.
