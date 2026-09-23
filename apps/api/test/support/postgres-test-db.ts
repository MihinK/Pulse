import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { defineConfig, MikroORM } from "@mikro-orm/postgresql";
import { buildMikroOrmOptions } from "../../src/mikro-orm.config";

const MIGRATION_USER = "pulse";
const MIGRATION_PASSWORD = "pulse_dev_password";
const APP_USER = "pulse_app";
const APP_PASSWORD = "pulse_app_dev_password";
const DB_NAME = "pulse";

export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  stop(): Promise<void>;
}

/**
 * Starts a throwaway Postgres in Docker, runs both migrations (schema, then RLS + the `pulse_app`
 * role) as the superuser, then points `process.env` at it with `DB_USER`/`DB_PASSWORD` set to the
 * unprivileged `pulse_app` role. This is the same two-role split as `docker-compose.yml` / ADR-003
 * — connecting as the superuser instead would make every RLS policy a silent no-op, so a test
 * that did that would pass for the wrong reason.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withUsername(MIGRATION_USER)
    .withPassword(MIGRATION_PASSWORD)
    .withDatabase(DB_NAME)
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getPort());
  process.env.DB_NAME = DB_NAME;
  process.env.DB_MIGRATION_USER = MIGRATION_USER;
  process.env.DB_MIGRATION_PASSWORD = MIGRATION_PASSWORD;
  process.env.DB_USER = APP_USER;
  process.env.DB_PASSWORD = APP_PASSWORD;

  const migratorOrm = await MikroORM.init(
    defineConfig(buildMikroOrmOptions(MIGRATION_USER, MIGRATION_PASSWORD)),
  );
  await migratorOrm.getMigrator().up();
  await migratorOrm.close(true);

  return {
    container,
    stop: async () => {
      await container.stop();
    },
  };
}
