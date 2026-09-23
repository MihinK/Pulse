import "reflect-metadata";
import { defineConfig, type Options } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { Organization } from "./modules/identity/domain/organization.entity";
import { User } from "./modules/identity/domain/user.entity";
import { Invitation } from "./modules/identity/domain/invitation.entity";
import { RefreshToken } from "./modules/identity/domain/refresh-token.entity";
import { Application } from "./modules/applications/domain/application.entity";
import { AuthConfig } from "./modules/applications/domain/auth-config.entity";
import { CheckRun } from "./modules/applications/domain/check-run.entity";
import { CheckResult } from "./modules/applications/domain/check-result.entity";
import { OutboxEntry } from "./modules/applications/domain/outbox-entry.entity";
import { AuditLog } from "./modules/applications/domain/audit-log.entity";

/**
 * A function, not a precomputed constant: `app.module.ts` calls this from inside
 * `MikroOrmModule.forRootAsync`'s factory, which only runs once Nest has instantiated
 * `ConfigModule` (and so loaded `.env`). Building this as a plain object at import time instead
 * would capture `process.env` before `ConfigModule.forRoot()` ever ran — imports are fully
 * evaluated before the importing module's own decorator body executes — silently falling back to
 * every default (including the wrong port) in local dev.
 *
 * `user`/`password` are passed in rather than read from env here because migrations and the
 * running API must connect as different roles — see ADR-003 and the RLS migration.
 */
export function buildMikroOrmOptions(user: string, password: string): Options {
  return {
    host: process.env.DB_HOST ?? "localhost",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    dbName: process.env.DB_NAME ?? "pulse",
    user,
    password,
    entities: [
      Organization,
      User,
      Invitation,
      RefreshToken,
      Application,
      AuthConfig,
      CheckRun,
      CheckResult,
      OutboxEntry,
      AuditLog,
    ],
    extensions: [Migrator],
    migrations: {
      path: "./src/migrations",
      glob: "!(*.d).{js,ts}",
    },
  };
}

/**
 * Used only by the MikroORM CLI (`pnpm migration:create` / `migration:up`). The CLI has no
 * ConfigModule / dotenv step of its own — env vars come straight from the invoking shell — so
 * there is no ordering concern here.
 */
export default defineConfig(
  buildMikroOrmOptions(
    process.env.DB_MIGRATION_USER ?? "pulse",
    process.env.DB_MIGRATION_PASSWORD ?? "pulse_dev_password",
  ),
);
