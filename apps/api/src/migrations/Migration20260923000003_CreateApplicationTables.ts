import { Migration } from "@mikro-orm/migrations";

/**
 * Sprint 3: applications and URL checks. `applications`/`check_runs`/`outbox`/`audit_logs` carry
 * `organization_id` directly (RLS scopes them the same way as sprint 2's tables). `auth_configs`
 * and `check_results` don't — matching the technical plan's data model exactly — so their RLS
 * policy (next migration) scopes transitively through `applications`/`check_runs`, the same
 * pattern already used for `refresh_tokens` via `users` in sprint 2.
 */
export class Migration20260923000003_CreateApplicationTables extends Migration {
  public up(): void {
    this.addSql(`
      create table "applications" (
        "id" uuid not null primary key,
        "organization_id" uuid not null references "organizations" ("id") on update cascade on delete cascade,
        "name" text not null,
        "base_url" text not null,
        "environment" varchar(20) not null check ("environment" in ('DEV', 'STAGING', 'PROD')),
        "description" text null,
        "tags" text[] not null default '{}',
        "check_interval_minutes" int not null default 5,
        "timeout_ms" int not null default 10000,
        "slow_threshold_ms" int not null default 2000,
        "expected_statuses" int[] null,
        "schema_validation" boolean not null default false,
        "status" varchar(20) not null default 'UNKNOWN' check ("status" in ('UP', 'DEGRADED', 'DOWN', 'UNKNOWN')),
        "deleted_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "version" int not null default 1
      );
    `);
    this.addSql(
      `create index "applications_organization_id_status_index" on "applications" ("organization_id", "status");`,
    );

    // No organization_id: RLS (next migration) scopes via a join to applications.
    this.addSql(`
      create table "auth_configs" (
        "id" uuid not null primary key,
        "application_id" uuid not null references "applications" ("id") on update cascade on delete cascade,
        "type" varchar(20) not null check ("type" in ('NONE', 'API_KEY', 'BEARER', 'BASIC', 'OAUTH2_CC', 'LOGIN_FLOW')),
        "config_encrypted" bytea null,
        "token_cache_encrypted" bytea null,
        "token_expires_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "version" int not null default 1,
        constraint "auth_configs_application_id_unique" unique ("application_id")
      );
    `);

    this.addSql(`
      create table "check_runs" (
        "id" uuid not null primary key,
        "organization_id" uuid not null references "organizations" ("id") on update cascade on delete cascade,
        "application_id" uuid not null references "applications" ("id") on update cascade on delete cascade,
        "api_document_id" uuid null,
        "trigger" varchar(20) not null check ("trigger" in ('MANUAL', 'SCHEDULED')),
        "triggered_by" uuid null references "users" ("id") on update cascade on delete set null,
        "status" varchar(20) not null default 'QUEUED' check ("status" in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
        "started_at" timestamptz null,
        "finished_at" timestamptz null,
        "total" int not null default 0,
        "passed" int not null default 0,
        "failed" int not null default 0,
        "skipped" int not null default 0,
        "avg_ms" numeric null,
        "p95_ms" numeric null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "version" int not null default 1
      );
    `);
    this.addSql(
      `create index "check_runs_application_id_started_at_index" on "check_runs" ("application_id", "started_at" desc);`,
    );

    // No organization_id: RLS (next migration) scopes via a join to check_runs.
    this.addSql(`
      create table "check_results" (
        "id" uuid not null primary key,
        "check_run_id" uuid not null references "check_runs" ("id") on update cascade on delete cascade,
        "endpoint_id" uuid null,
        "method" varchar(10) not null default 'GET',
        "url" text not null,
        "status_code" int null,
        "response_ms" int null,
        "outcome" varchar(20) not null check ("outcome" in ('PASSED', 'FAILED', 'DEGRADED', 'SKIPPED')),
        "failure_reason" text null,
        "checked_at" timestamptz not null default now()
      );
    `);
    this.addSql(
      `create index "check_results_check_run_id_index" on "check_results" ("check_run_id");`,
    );

    this.addSql(`
      create table "outbox" (
        "id" uuid not null primary key,
        "organization_id" uuid not null references "organizations" ("id") on update cascade on delete cascade,
        "kind" text not null,
        "payload" jsonb not null,
        "created_at" timestamptz not null default now(),
        "processed_at" timestamptz null
      );
    `);
    this.addSql(
      `create index "outbox_unprocessed_index" on "outbox" ("created_at") where "processed_at" is null;`,
    );

    this.addSql(`
      create table "audit_logs" (
        "id" uuid not null primary key,
        "organization_id" uuid not null references "organizations" ("id") on update cascade on delete cascade,
        "actor_id" uuid not null references "users" ("id") on update cascade on delete restrict,
        "action" text not null,
        "entity_type" text not null,
        "entity_id" uuid not null,
        "before" jsonb null,
        "after" jsonb null,
        "at" timestamptz not null default now()
      );
    `);
    this.addSql(`create index "audit_logs_organization_id_at_index" on "audit_logs" ("organization_id", "at" desc);`);
  }

  public override down(): void {
    this.addSql(`drop table if exists "audit_logs" cascade;`);
    this.addSql(`drop table if exists "outbox" cascade;`);
    this.addSql(`drop table if exists "check_results" cascade;`);
    this.addSql(`drop table if exists "check_runs" cascade;`);
    this.addSql(`drop table if exists "auth_configs" cascade;`);
    this.addSql(`drop table if exists "applications" cascade;`);
  }
}
