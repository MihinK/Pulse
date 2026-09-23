import { Migration } from "@mikro-orm/migrations";

/**
 * RLS for sprint 3's tables, same policy shape as
 * Migration20260923000002_EnableRowLevelSecurity. `applications`, `check_runs`, `outbox`, and
 * `audit_logs` carry `organization_id` directly. `auth_configs` and `check_results` don't (see
 * the previous migration's header comment), so their policy scopes transitively through
 * `applications`/`check_runs` — the same `EXISTS` shape already used for `refresh_tokens` via
 * `users`.
 */
export class Migration20260923000004_EnableApplicationRowLevelSecurity extends Migration {
  public up(): void {
    const appRole = safeRoleName(process.env.DB_USER ?? "pulse_app");

    this.addSql(`
      GRANT SELECT, INSERT, UPDATE, DELETE
      ON "applications", "auth_configs", "check_runs", "check_results", "outbox", "audit_logs"
      TO "${appRole}";
    `);

    this.addSql(`ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "applications"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR "organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
      );
    `);

    this.addSql(`ALTER TABLE "auth_configs" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "auth_configs"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR EXISTS (
          SELECT 1 FROM "applications" a
          WHERE a."id" = "auth_configs"."application_id"
            AND a."organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
      );
    `);

    this.addSql(`ALTER TABLE "check_runs" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "check_runs"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR "organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
      );
    `);

    this.addSql(`ALTER TABLE "check_results" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "check_results"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR EXISTS (
          SELECT 1 FROM "check_runs" cr
          WHERE cr."id" = "check_results"."check_run_id"
            AND cr."organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
      );
    `);

    this.addSql(`ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "outbox"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR "organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
      );
    `);

    this.addSql(`ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "audit_logs"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR "organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
      );
    `);
  }

  public override down(): void {
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "audit_logs";`);
    this.addSql(`ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "outbox";`);
    this.addSql(`ALTER TABLE "outbox" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "check_results";`);
    this.addSql(`ALTER TABLE "check_results" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "check_runs";`);
    this.addSql(`ALTER TABLE "check_runs" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "auth_configs";`);
    this.addSql(`ALTER TABLE "auth_configs" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "applications";`);
    this.addSql(`ALTER TABLE "applications" DISABLE ROW LEVEL SECURITY;`);
  }
}

/** Role names can't be parameterized in DDL; restrict to a safe identifier shape instead. */
function safeRoleName(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : "pulse_app";
}
