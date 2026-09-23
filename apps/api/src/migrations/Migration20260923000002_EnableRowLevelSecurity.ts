import { Migration } from "@mikro-orm/migrations";

/**
 * ADR-003: Row-Level Security, enforced against a role that is neither the table owner nor a
 * superuser — both bypass RLS in Postgres regardless of policy, which would make every policy
 * below a silent no-op. `pulse_app` is that role; the app's runtime datasource connects as it
 * (see `mikro-orm.config.ts`), while migrations keep running as the superuser that owns the
 * tables (`DB_MIGRATION_USER`, default `pulse`).
 *
 * Every policy reads two session variables that `TenancyInterceptor` sets at the start of each
 * request's transaction: `app.current_org_id` and `app.bypass_rls` (true for the Platform Owner,
 * and for the handful of `@Public()` routes — login-by-email, invitation-accept — that must
 * legitimately cross the org boundary before an org is known). Neither variable is ever set
 * outside that interceptor (or `PulseOwnerSeeder`'s own bootstrap transaction), so a query that
 * reaches Postgres through any other path sees both as unset and is denied by default.
 */
export class Migration20260923000002_EnableRowLevelSecurity extends Migration {
  public up(): void {
    const appRole = safeRoleName(process.env.DB_USER ?? "pulse_app");
    const appPassword = escapeLiteral(process.env.DB_PASSWORD ?? "pulse_app_dev_password");

    this.addSql(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${appRole}') THEN
          CREATE ROLE "${appRole}" LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        ELSE
          ALTER ROLE "${appRole}" WITH PASSWORD '${appPassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END
      $$;
    `);

    this.addSql(`GRANT USAGE ON SCHEMA public TO "${appRole}";`);
    this.addSql(`
      GRANT SELECT, INSERT, UPDATE, DELETE
      ON "organizations", "users", "invitations", "refresh_tokens"
      TO "${appRole}";
    `);

    this.addSql(`ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "organizations"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR "id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
      );
    `);

    this.addSql(`ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "users"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR "organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
      );
    `);

    this.addSql(`ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "invitations"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR "organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
      );
    `);

    // refresh_tokens has no organization_id of its own; scope transitively through its user.
    // Every access in this sprint is bypass-scoped anyway (login/refresh/logout are all
    // @Public()) — this is defense-in-depth for a future authenticated endpoint.
    this.addSql(`ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "refresh_tokens"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR EXISTS (
          SELECT 1 FROM "users" u
          WHERE u."id" = "refresh_tokens"."user_id"
            AND u."organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
      );
    `);
  }

  public override down(): void {
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "refresh_tokens";`);
    this.addSql(`ALTER TABLE "refresh_tokens" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "invitations";`);
    this.addSql(`ALTER TABLE "invitations" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "users";`);
    this.addSql(`ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "organizations";`);
    this.addSql(`ALTER TABLE "organizations" DISABLE ROW LEVEL SECURITY;`);
  }
}

/** Role names can't be parameterized in DDL; restrict to a safe identifier shape instead. */
function safeRoleName(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : "pulse_app";
}

/** Doubles single quotes so the value is a safe SQL string literal. */
function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}
