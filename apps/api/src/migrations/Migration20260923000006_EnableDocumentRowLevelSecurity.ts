import { Migration } from "@mikro-orm/migrations";

/**
 * RLS for sprint 4's tables, same policy shape as
 * Migration20260923000004_EnableApplicationRowLevelSecurity. Neither table carries
 * `organization_id` (see the previous migration's header comment), so both policies scope
 * transitively — `api_documents` one hop through `applications`, `endpoints` two hops through
 * `api_documents` then `applications`.
 */
export class Migration20260923000006_EnableDocumentRowLevelSecurity extends Migration {
  public up(): void {
    const appRole = safeRoleName(process.env.DB_USER ?? "pulse_app");

    this.addSql(`
      GRANT SELECT, INSERT, UPDATE, DELETE
      ON "api_documents", "endpoints"
      TO "${appRole}";
    `);

    this.addSql(`ALTER TABLE "api_documents" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "api_documents"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR EXISTS (
          SELECT 1 FROM "applications" a
          WHERE a."id" = "api_documents"."application_id"
            AND a."organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
      );
    `);

    this.addSql(`ALTER TABLE "endpoints" ENABLE ROW LEVEL SECURITY;`);
    this.addSql(`
      CREATE POLICY "tenant_isolation" ON "endpoints"
      USING (
        current_setting('app.bypass_rls', true) = 'true'
        OR EXISTS (
          SELECT 1 FROM "api_documents" ad
          JOIN "applications" a ON a."id" = ad."application_id"
          WHERE ad."id" = "endpoints"."api_document_id"
            AND a."organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
      );
    `);
  }

  public override down(): void {
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "endpoints";`);
    this.addSql(`ALTER TABLE "endpoints" DISABLE ROW LEVEL SECURITY;`);
    this.addSql(`DROP POLICY IF EXISTS "tenant_isolation" ON "api_documents";`);
    this.addSql(`ALTER TABLE "api_documents" DISABLE ROW LEVEL SECURITY;`);
  }
}

/** Role names can't be parameterized in DDL; restrict to a safe identifier shape instead. */
function safeRoleName(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : "pulse_app";
}
