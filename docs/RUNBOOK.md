# Runbook

How to actually run Pulse locally: infra, env vars, migrations, the two apps, and the test
suites. For what the system does and why, see [README.md](./README.md) and the numbered docs it
indexes.

## Prerequisites

- Node.js >= 20 (CI runs 22; match that if you have a choice)
- pnpm 12.5.1 (pinned in the root `package.json`'s `packageManager` field — `corepack enable`
  picks it up automatically)
- Docker, for local infra (`docker compose`) and for the API's e2e test suite (Testcontainers)

## 1. Install

```bash
git clone <repo-url>
cd pulse
pnpm install
```

This is a pnpm workspace (`apps/*`, `packages/*`) driven by Turborepo — every root script fans out
per-package.

## 2. Start local infra

```bash
docker compose up -d
```

Starts Postgres (`localhost:5432`), Redis (`localhost:6379`), MinIO (S3-compatible storage,
`localhost:9000`, console on `9001`), and Mailpit (SMTP catcher, web UI on `localhost:8025`) — see
`docker-compose.yml` for credentials. Wait for the containers to report healthy
(`docker compose ps`) before continuing; the healthchecks are what `pg_isready`/`redis-cli ping`
report, not just "container started."

## 3. Configure environment

Each app reads its own `.env` file — Next.js and NestJS's `ConfigModule` both resolve dotenv paths
relative to their own package's working directory, not the repo root.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

The example files' defaults already match `docker-compose.yml`, so no edits are needed for local
dev. Two things worth knowing before you touch them:

- `apps/api/.env`'s `DB_USER`/`DB_PASSWORD` (default `pulse_app`) is the API's own unprivileged
  runtime role — **never** the same as `DB_MIGRATION_USER`/`DB_MIGRATION_PASSWORD` (default
  `pulse`, the table-owning superuser used only by `migration:up`). Row-Level Security is bypassed
  for table owners and superusers unconditionally, so connecting the running API with migration
  credentials would make every RLS policy in the system a silent no-op. See
  [07-security.md](./07-security.md) and [ADR-003](./adr/003-multitenancy-row-level-security.md).
- `PLATFORM_OWNER_EMAIL`/`PLATFORM_OWNER_PASSWORD` seed the first Platform Owner account on boot
  (`PulseOwnerSeeder`) if none exists yet — this is how you get your first login. Change the
  password before any boot that isn't purely local/throwaway.
- `STORAGE_*` (sprint 4) points `S3CompatibleStorage` at the MinIO container from step 2 — the
  example defaults already match `docker-compose.yml`'s MinIO credentials
  (`pulse`/`pulse_dev_password`). The bucket (`STORAGE_BUCKET`, default `pulse-documents`) is
  created automatically on API boot if it doesn't already exist.

## 4. Run migrations

```bash
pnpm --filter @pulse/api migration:up
```

Runs as `DB_MIGRATION_USER` (the superuser), creating every table, the `pulse_app` role, and every
RLS policy. Re-running is safe (MikroORM tracks applied migrations). See
[04-data-model.md](./04-data-model.md) for what each migration does.

## 5. Start the apps

```bash
# both apps, watch mode, from the repo root
pnpm dev

# or one at a time
pnpm --filter @pulse/api dev    # NestJS on :3001 (Swagger UI at /api/docs)
pnpm --filter @pulse/web dev    # Next.js on :3000
```

The API's worker (`OutboxRelay`, `RunCheckProcessor` — the outbox → BullMQ → check-run pipeline,
see [features/applications-and-url-checks.md](./features/applications-and-url-checks.md)) runs
in-process inside the same API server; there's no separate worker process to start.

**Verify it's up:**

```bash
curl http://localhost:3001/health
```

should return `{"status":"UP",...}`. Then open `http://localhost:3000/login` and sign in with
`PLATFORM_OWNER_EMAIL`/`PLATFORM_OWNER_PASSWORD` from step 3.

## 6. Running the test suites

```bash
# unit tests, all packages, with the 90% coverage gate — no Docker needed
pnpm test:coverage

# one package at a time
pnpm --filter @pulse/api test:coverage
pnpm --filter @pulse/web test:coverage
pnpm --filter @pulse/shared test:coverage

# API integration/e2e tests — boots a real Nest app against real Postgres AND Redis via
# Testcontainers. Requires Docker running (not just installed).
pnpm --filter @pulse/api test:e2e
```

Single test file:

```bash
cd apps/api && npx jest path/to/file.spec.ts
cd apps/web && npx vitest run path/to/file.spec.tsx
cd apps/api && npx jest --config ./test/jest-e2e.json path/to/file.e2e-spec.ts
```

Full detail on what's covered and what's deliberately excluded: [08-testing.md](./08-testing.md).

## 7. Linting, type-checking, formatting

```bash
pnpm lint         # eslint, --max-warnings 0, every package
pnpm typecheck    # tsc --noEmit, every package
pnpm format       # prettier --write
pnpm format:check # prettier --check (what CI runs)
```

## 8. Production build

```bash
pnpm build
```

Builds every package via Turborepo, respecting the dependency graph (`packages/shared` builds
before the two apps that depend on it). To actually run a built app:

```bash
# API — reads the same apps/api/.env
cd apps/api && node dist/main.js

# Web — reads apps/web/.env.local; NEXT_PUBLIC_API_URL must point at the running API
cd apps/web && pnpm start
```

There is no separate build/run step for the worker (`OutboxRelay`/`RunCheckProcessor`) — it's part
of the same `dist/main.js` process.

## Troubleshooting

- **`ERR_PNPM_IGNORED_BUILDS` during `pnpm install`**: a transitive dependency wants to run a
  postinstall script pnpm hasn't been told about. `pnpm-workspace.yaml`'s `allowBuilds` list
  already covers everything this repo currently needs; if a new dependency adds one,
  `pnpm approve-builds` and commit the resulting `allowBuilds` entry.
- **RLS silently isn't filtering anything**: almost always means the API connected as the
  migration/superuser role instead of `pulse_app` — see step 3's warning above and
  [07-security.md](./07-security.md#the-table-owner-gotcha).
- **`pnpm --filter @pulse/api test:e2e` hangs or fails to connect**: Docker needs to be *running*,
  not just installed (`docker version` should show a `Server` block, not just `Client`). Every
  e2e suite boots the full `AppModule`, which needs a real Postgres, a real Redis (BullMQ), and
  (sprint 4) a real MinIO — `S3CompatibleStorage`'s `onModuleInit` tries to reach real object
  storage even for suites that never touch documents — to boot and shut down cleanly. See
  `apps/api/test/support/redis-test-db.ts`'s comment for why this generalizes past whichever
  suite first needed the dependency.
- **A full local e2e run (`pnpm --filter @pulse/api test:e2e`, every suite at once) flakes with an
  unrelated 401/timeout**: each suite starts its own Postgres + Redis + MinIO Testcontainers: five
  suites run concurrently is eleven-plus containers competing for the same Docker daemon, which
  can starve one enough to cause a spurious failure unrelated to the change you're testing. Rerun
  the one failing suite in isolation (`npx jest --config ./test/jest-e2e.json path/to/file.e2e-spec.ts`)
  before assuming it's a real regression; `--runInBand` also helps by not running suites in
  parallel workers.
- **A single e2e test run gets `429 Too Many Requests` partway through**: the login endpoint's
  brute-force throttle (5/min) and the app-wide throttle (60/min) are real production limits that
  a full e2e suite's request volume can exceed. `apps/api/test/setup-env.ts` already raises both
  for `test:e2e` — if you're invoking Jest some other way, that file's comment explains what to
  set and why it has to happen before the test file's own imports resolve.
