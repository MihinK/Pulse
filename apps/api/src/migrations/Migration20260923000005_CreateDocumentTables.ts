import { Migration } from "@mikro-orm/migrations";

/**
 * Sprint 4: API documents. Neither table carries `organization_id` — matches the technical
 * plan's data model exactly — so the RLS policy (next migration) scopes transitively:
 * `api_documents` through `applications` (one hop), `endpoints` through `api_documents` then
 * `applications` (two hops). Same pattern already used for `auth_configs`/`check_results` in
 * sprint 3.
 */
export class Migration20260923000005_CreateDocumentTables extends Migration {
  public up(): void {
    this.addSql(`
      create table "api_documents" (
        "id" uuid not null primary key,
        "application_id" uuid not null references "applications" ("id") on update cascade on delete cascade,
        "format" varchar(20) not null check ("format" in ('OPENAPI_3', 'SWAGGER_2', 'POSTMAN_V21')),
        "spec_version" text null,
        "version_no" int not null,
        "storage_key" text not null,
        "checksum" text not null,
        "is_active" boolean not null default false,
        "status" varchar(20) not null default 'PENDING' check ("status" in ('PENDING', 'READY', 'FAILED')),
        "failure_reason" text null,
        "uploaded_by" uuid not null references "users" ("id") on update cascade on delete restrict,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "version" int not null default 1,
        constraint "api_documents_application_id_version_no_unique" unique ("application_id", "version_no")
      );
    `);
    this.addSql(
      `create index "api_documents_application_id_index" on "api_documents" ("application_id");`,
    );
    // Partial unique index (not a plain unique constraint): "at most one active version per
    // application" only needs to hold among active rows — Postgres partial unique indexes are
    // exactly this, a plain unique constraint on (application_id, is_active) would also forbid
    // more than one *inactive* row, which is wrong.
    this.addSql(`
      create unique index "api_documents_one_active_per_application"
      on "api_documents" ("application_id")
      where "is_active";
    `);

    this.addSql(`
      create table "endpoints" (
        "id" uuid not null primary key,
        "api_document_id" uuid not null references "api_documents" ("id") on update cascade on delete cascade,
        "method" varchar(10) not null,
        "path" text not null,
        "operation_id" text null,
        "expected_statuses" int[] null,
        "response_schema" jsonb null,
        "sample_params" jsonb null,
        "sample_body" jsonb null,
        "included" boolean not null default true,
        "write_enabled" boolean not null default false,
        "write_confirmed_by" uuid null references "users" ("id") on update cascade on delete set null,
        "write_confirmed_at" timestamptz null,
        "allow_in_schedule" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "version" int not null default 1,
        constraint "endpoints_api_document_id_method_path_unique" unique ("api_document_id", "method", "path")
      );
    `);
    this.addSql(`create index "endpoints_api_document_id_index" on "endpoints" ("api_document_id");`);

    // check_runs.api_document_id (sprint 3) was a plain nullable uuid with no FK — api_documents
    // didn't exist yet. Wire the constraint up now that it does.
    this.addSql(`
      alter table "check_runs"
      add constraint "check_runs_api_document_id_foreign"
      foreign key ("api_document_id") references "api_documents" ("id") on update cascade on delete set null;
    `);
  }

  public override down(): void {
    this.addSql(`alter table "check_runs" drop constraint if exists "check_runs_api_document_id_foreign";`);
    this.addSql(`drop table if exists "endpoints" cascade;`);
    this.addSql(`drop table if exists "api_documents" cascade;`);
  }
}
