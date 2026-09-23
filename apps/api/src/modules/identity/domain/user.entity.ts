import { Entity, PrimaryKey, Property, Enum, ManyToOne, Unique, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { Role } from "./role.enum";
import { Organization } from "./organization.entity";

/**
 * `organization` is null only for the Platform Owner (technical plan section 3) — every ADMIN
 * and VIEWER belongs to exactly one organisation. Unique on (organization, email), not on email
 * alone: the same email may hold separate accounts in separate organisations (see
 * `AuthService.login`, which accounts for this).
 */
@Entity({ tableName: "users" })
@Unique({ properties: ["organization", "email"] })
export class User {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(() => Organization, { fieldName: "organization_id", nullable: true })
  public readonly organization?: Organization | undefined;

  @Property()
  public readonly email: string;

  @Property({ fieldName: "password_hash" })
  public passwordHash: string;

  @Enum(() => Role)
  public readonly role: Role;

  @Property({ fieldName: "time_zone" })
  public timeZone: string;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "updated_at", onUpdate: () => new Date() })
  public updatedAt: Date = new Date();

  @Property({ version: true })
  public readonly version: number = 1;

  public constructor(
    email: string,
    passwordHash: string,
    role: Role,
    organization?: Organization,
    timeZone = "UTC",
  ) {
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role;
    this.organization = organization;
    this.timeZone = timeZone;
  }

  public isPlatformOwner(): boolean {
    return this.role === Role.PLATFORM_OWNER;
  }

  public organizationId(): string | undefined {
    return this.organization?.id;
  }

  public updatePasswordHash(passwordHash: string): void {
    this.passwordHash = passwordHash;
  }

  public updateTimeZone(timeZone: string): void {
    this.timeZone = timeZone;
  }
}
