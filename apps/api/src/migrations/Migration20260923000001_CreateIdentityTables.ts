import { Migration } from "@mikro-orm/migrations";

/**
 * Organisations, users, invitations and refresh tokens (technical plan section 3, plus the
 * `refresh_tokens` table added for token rotation — see docs/04-data-model.md). UUID v7 primary
 * keys, `created_at`/`updated_at` in UTC, `version` for optimistic locking, per the data model's
 * opening paragraph. Row-Level Security is enabled separately, in the next migration, once the
 * `pulse_app` role that RLS is enforced against exists.
 */
export class Migration20260923000001_CreateIdentityTables extends Migration {
  public up(): void {
    this.addSql(`
      create table "organizations" (
        "id" uuid not null primary key,
        "name" text not null,
        "slug" text not null,
        "status" varchar(20) not null default 'ACTIVE' check ("status" in ('ACTIVE', 'SUSPENDED')),
        "edition" varchar(20) not null check ("edition" in ('CLOUD', 'PRIVATE')),
        "default_time_zone" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "version" int not null default 1,
        constraint "organizations_slug_unique" unique ("slug")
      );
    `);

    this.addSql(`
      create table "users" (
        "id" uuid not null primary key,
        "organization_id" uuid null references "organizations" ("id") on update cascade on delete cascade,
        "email" text not null,
        "password_hash" text not null,
        "role" varchar(20) not null check ("role" in ('PLATFORM_OWNER', 'ADMIN', 'VIEWER')),
        "time_zone" text not null default 'UTC',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "version" int not null default 1,
        constraint "users_organization_id_email_unique" unique ("organization_id", "email")
      );
    `);
    this.addSql(`create index "users_organization_id_index" on "users" ("organization_id");`);

    this.addSql(`
      create table "invitations" (
        "id" uuid not null primary key,
        "organization_id" uuid not null references "organizations" ("id") on update cascade on delete cascade,
        "email" text not null,
        "role" varchar(20) not null check ("role" in ('PLATFORM_OWNER', 'ADMIN', 'VIEWER')),
        "token_hash" text not null,
        "expires_at" timestamptz not null,
        "accepted_at" timestamptz null,
        "invited_by" uuid not null references "users" ("id") on update cascade on delete restrict,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "version" int not null default 1,
        constraint "invitations_token_hash_unique" unique ("token_hash")
      );
    `);
    this.addSql(
      `create index "invitations_organization_id_index" on "invitations" ("organization_id");`,
    );

    this.addSql(`
      create table "refresh_tokens" (
        "id" uuid not null primary key,
        "user_id" uuid not null references "users" ("id") on update cascade on delete cascade,
        "token_hash" text not null,
        "expires_at" timestamptz not null,
        "revoked_at" timestamptz null,
        "replaced_by_token_id" uuid null references "refresh_tokens" ("id") on update cascade on delete set null,
        "created_at" timestamptz not null default now(),
        constraint "refresh_tokens_token_hash_unique" unique ("token_hash")
      );
    `);
    this.addSql(`create index "refresh_tokens_user_id_index" on "refresh_tokens" ("user_id");`);
  }

  public override down(): void {
    this.addSql(`drop table if exists "refresh_tokens" cascade;`);
    this.addSql(`drop table if exists "invitations" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
    this.addSql(`drop table if exists "organizations" cascade;`);
  }
}
