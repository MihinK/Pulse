import { Entity, PrimaryKey, Property, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { organizationRef, userRef } from "./entity-refs";

/** Append-only. This sprint writes one row on application create (FR-USR-02's write side). */
@Entity({ tableName: "audit_logs" })
export class AuditLog {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(organizationRef, { fieldName: "organization_id" })
  public readonly organization: Organization;

  @ManyToOne(userRef, { fieldName: "actor_id" })
  public readonly actor: User;

  @Property()
  public readonly action: string;

  @Property({ fieldName: "entity_type" })
  public readonly entityType: string;

  @Property({ fieldName: "entity_id", type: "uuid" })
  public readonly entityId: string;

  @Property({ type: "json", nullable: true })
  public readonly before?: Record<string, unknown>;

  @Property({ type: "json", nullable: true })
  public readonly after?: Record<string, unknown>;

  @Property()
  public readonly at: Date = new Date();

  public constructor(
    organization: Organization,
    actor: User,
    action: string,
    entityType: string,
    entityId: string,
    fields: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {},
  ) {
    this.organization = organization;
    this.actor = actor;
    this.action = action;
    this.entityType = entityType;
    this.entityId = entityId;
    if (fields.before !== undefined) this.before = fields.before;
    if (fields.after !== undefined) this.after = fields.after;
  }
}
