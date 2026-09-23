import { Entity, PrimaryKey, Property, Enum, OneToOne } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { Application } from "./application.entity";
import { AuthType } from "./auth-type.enum";
import { touchUpdatedAt } from "./entity-refs";

/**
 * One-to-one with {@link Application}. `configEncrypted` holds the AES-256-GCM ciphertext of the
 * strategy-specific credentials (produced by `SecretCipher`, FR-APP-05) — `null` only for
 * `NONE`. Never returned by any read endpoint; see `ApplicationResponseDto`, which has no field
 * for it at all rather than a redaction rule that could be gotten wrong later.
 * `tokenCacheEncrypted`/`tokenExpiresAt` exist for OAUTH2_CC/LOGIN_FLOW token caching — unused
 * until sprint 5, included now so that sprint doesn't need its own schema migration.
 */
@Entity({ tableName: "auth_configs" })
export class AuthConfig {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @OneToOne(() => Application, { fieldName: "application_id", owner: true })
  public readonly application: Application;

  @Enum(() => AuthType)
  public type: AuthType;

  @Property({ fieldName: "config_encrypted", type: "bytea", nullable: true })
  public configEncrypted?: Buffer | undefined;

  @Property({ fieldName: "token_cache_encrypted", type: "bytea", nullable: true })
  public tokenCacheEncrypted?: Buffer | undefined;

  @Property({ fieldName: "token_expires_at", nullable: true })
  public tokenExpiresAt?: Date | undefined;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "updated_at", onUpdate: touchUpdatedAt })
  public updatedAt: Date = new Date();

  @Property({ version: true })
  public readonly version: number = 1;

  public constructor(application: Application, type: AuthType, configEncrypted?: Buffer) {
    this.application = application;
    this.type = type;
    this.configEncrypted = configEncrypted;
  }

  public replace(type: AuthType, configEncrypted?: Buffer): void {
    this.type = type;
    this.configEncrypted = configEncrypted;
    this.tokenCacheEncrypted = undefined;
    this.tokenExpiresAt = undefined;
  }
}
