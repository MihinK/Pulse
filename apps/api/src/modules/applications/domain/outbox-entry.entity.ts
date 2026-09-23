import { Entity, PrimaryKey, Property, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { Organization } from "../../identity/domain/organization.entity";
import { organizationRef } from "./entity-refs";

/**
 * Transactional outbox (ADR-002): a row is written in the same DB transaction as the business
 * change it announces, so "commit DB + enqueue a job" is atomic without a distributed
 * transaction. `OutboxRelay` is the only thing that ever reads unprocessed rows and forwards them
 * to BullMQ — nothing else may depend on this table's contents surviving past that relay.
 */
@Entity({ tableName: "outbox" })
export class OutboxEntry {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @ManyToOne(organizationRef, { fieldName: "organization_id" })
  public readonly organization: Organization;

  @Property()
  public readonly kind: string;

  @Property({ type: "json" })
  public readonly payload: Record<string, unknown>;

  @Index()
  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "processed_at", nullable: true })
  public processedAt?: Date;

  public constructor(organization: Organization, kind: string, payload: Record<string, unknown>) {
    this.organization = organization;
    this.kind = kind;
    this.payload = payload;
  }

  public markProcessed(now: Date): void {
    this.processedAt = now;
  }
}
