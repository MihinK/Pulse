import { Entity, PrimaryKey, Property, Enum } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { OrganizationStatus } from "./organization-status.enum";
import { Edition } from "./edition.enum";

/**
 * The tenant root. Every other tenant table carries `organizationId`, scoped by the Row-Level
 * Security policies created in the RLS migration (ADR-003). Created only by the Platform Owner
 * (technical plan section 2.1) — enforced by {@link OrganizationService}, not by this entity.
 */
@Entity({ tableName: "organizations" })
export class Organization {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Property()
  public name: string;

  @Property({ unique: true })
  public readonly slug: string;

  @Enum(() => OrganizationStatus)
  public status: OrganizationStatus = OrganizationStatus.ACTIVE;

  @Enum(() => Edition)
  public readonly edition: Edition;

  @Property({ fieldName: "default_time_zone" })
  public defaultTimeZone: string;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "updated_at", onUpdate: () => new Date() })
  public updatedAt: Date = new Date();

  @Property({ version: true })
  public readonly version: number = 1;

  public constructor(
    name: string,
    slug: string,
    defaultTimeZone: string,
    edition: Edition = Edition.CLOUD,
  ) {
    this.name = name;
    this.slug = slug;
    this.defaultTimeZone = defaultTimeZone;
    this.edition = edition;
  }

  public suspend(): void {
    this.status = OrganizationStatus.SUSPENDED;
  }

  public activate(): void {
    this.status = OrganizationStatus.ACTIVE;
  }

  public isActive(): boolean {
    return this.status === OrganizationStatus.ACTIVE;
  }

  public rename(name: string): void {
    this.name = name;
  }
}
