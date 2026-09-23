import { Entity, PrimaryKey, Property, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import type { Clock } from "@pulse/shared";
import { User } from "./user.entity";

/**
 * Supports rotation (technical plan section 8.1, "rotating refresh tokens"): each use creates a
 * new row and revokes this one, chained via `replacedBy`, so a stolen-and-reused token is
 * detectable (its `revokedAt` is already set). The token value itself is never stored — only its
 * SHA-256 hash — and never a JWT, since it must be opaque and revocable.
 */
@Entity({ tableName: "refresh_tokens" })
export class RefreshToken {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(() => User, { fieldName: "user_id" })
  public readonly user: User;

  @Property({ fieldName: "token_hash", unique: true })
  public readonly tokenHash: string;

  @Property({ fieldName: "expires_at" })
  public readonly expiresAt: Date;

  @Property({ fieldName: "revoked_at", nullable: true })
  public revokedAt?: Date;

  @ManyToOne(() => RefreshToken, { fieldName: "replaced_by_token_id", nullable: true })
  public replacedBy?: RefreshToken | undefined;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  public constructor(user: User, tokenHash: string, expiresAt: Date) {
    this.user = user;
    this.tokenHash = tokenHash;
    this.expiresAt = expiresAt;
  }

  public isRevoked(): boolean {
    // MikroORM hydrates a NULL "revoked_at" column as `null`, not `undefined` — `!= null` (loose)
    // catches both that case and a freshly constructed, never-persisted token.
    return this.revokedAt != null;
  }

  public isValid(clock: Clock): boolean {
    return !this.isRevoked() && clock.now().getTime() < this.expiresAt.getTime();
  }

  public revoke(clock: Clock, replacedBy?: RefreshToken): void {
    this.revokedAt = clock.now();
    this.replacedBy = replacedBy;
  }
}
