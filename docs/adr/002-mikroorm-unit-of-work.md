# ADR-002: MikroORM for the Unit-of-Work / ACID transaction pattern

**Status:** Implemented (accepted sprint 1, landed sprint 2 — see [04-data-model.md](../04-data-model.md))

## Context

The requirements doc's ACID principle (section 3.1 of the technical plan) requires that a check
run's results, its summary counts, and its status commit together or not at all — same for
uploading a spec document and its extracted endpoints. This needs a transaction boundary that
maps cleanly onto a business operation, not onto individual repository calls scattered across a
service method.

## Decision

MikroORM as the ORM, using its built-in Unit of Work and Identity Map rather than hand-rolling a
transaction wrapper around TypeORM or Prisma.

## Why

- MikroORM's Unit of Work batches all changes made during a request/operation and flushes them
  in one transaction automatically — the pattern the technical plan calls for is what the ORM
  does by default, not something built on top of it.
- Its Identity Map means loading the same entity twice within one unit of work returns the same
  object instance, which avoids a class of bugs where two code paths edit "different copies"
  of the same row and one write clobbers the other.
- First-class migrations, matching the requirement for versioned, reviewed schema changes.

## Alternatives considered

- **TypeORM**: more widely used, but its Active Record and Data Mapper modes both need an
  explicit `queryRunner`/transaction wrapper threaded through service methods by hand — the
  Unit-of-Work boundary would be something we build and maintain, not something the ORM gives
  us.
- **Prisma**: excellent DX and generated types, but its interactive transactions are closer to
  "run these operations in a transaction" than a true Unit of Work with an Identity Map, and its
  schema-first workflow sits awkwardly with rich domain entities that have behaviour (`OOP`
  requirement, technical plan section 3.1).

## Consequences

- Domain entities (`Application`, `CheckRun`, `CheckResult`, ...) will be MikroORM entities with
  behaviour, not anaemic data classes — methods like `CheckRun.complete()` live on the entity.
- Every "commits together" operation listed in the technical plan (section 3.1) becomes one Unit
  of Work flush, not several `save()` calls.
- Integration tests (sprint 2 onward) run against a real PostgreSQL via Testcontainers
  specifically to prove atomicity — a mocked ORM can't demonstrate a transaction actually
  rolling back.
