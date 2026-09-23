import { Entity, PrimaryKey, Property, Enum, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { Organization } from "../../identity/domain/organization.entity";
import { Environment } from "./environment.enum";
import { ApplicationStatus } from "./application-status.enum";
import { IntegerArrayType } from "./integer-array.type";
import { organizationRef, touchUpdatedAt } from "./entity-refs";

/**
 * FR-APP-01..06. `status` is the aggregate health shown in the applications list — updated by
 * {@link recordCompletedRun}, never set directly by a controller. `expectedStatuses` is `null` by
 * default, meaning "any 2xx/3xx response" (the plan's FR-HC-03 default) rather than an explicit
 * list — `RunCheckService`'s outcome evaluator treats `null` and a populated array differently,
 * so it isn't stored as an enumerated 2xx/3xx list here.
 */
@Entity({ tableName: "applications" })
export class Application {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(organizationRef, { fieldName: "organization_id" })
  public readonly organization: Organization;

  @Property()
  public name: string;

  @Property({ fieldName: "base_url" })
  public baseUrl: string;

  @Enum(() => Environment)
  public environment: Environment;

  @Property({ nullable: true })
  public description?: string;

  @Property({ type: "array" })
  public tags: string[] = [];

  @Property({ fieldName: "check_interval_minutes" })
  public checkIntervalMinutes = 5;

  @Property({ fieldName: "timeout_ms" })
  public timeoutMs = 10_000;

  @Property({ fieldName: "slow_threshold_ms" })
  public slowThresholdMs = 2000;

  @Property({ fieldName: "expected_statuses", type: IntegerArrayType, nullable: true })
  public expectedStatuses?: number[] | null;

  @Property({ fieldName: "schema_validation" })
  public schemaValidation = false;

  @Enum(() => ApplicationStatus)
  public status: ApplicationStatus = ApplicationStatus.UNKNOWN;

  @Property({ fieldName: "deleted_at", nullable: true })
  public deletedAt?: Date;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "updated_at", onUpdate: touchUpdatedAt })
  public updatedAt: Date = new Date();

  @Property({ version: true })
  public readonly version: number = 1;

  public constructor(
    organization: Organization,
    name: string,
    baseUrl: string,
    environment: Environment,
  ) {
    this.organization = organization;
    this.name = name;
    this.baseUrl = baseUrl;
    this.environment = environment;
  }

  public organizationId(): string {
    return this.organization.id;
  }

  public isDeleted(): boolean {
    return this.deletedAt != null;
  }

  public softDelete(): void {
    this.deletedAt = new Date();
  }

  public update(fields: {
    name?: string | undefined;
    baseUrl?: string | undefined;
    environment?: Environment | undefined;
    description?: string | undefined;
    tags?: string[] | undefined;
    checkIntervalMinutes?: number | undefined;
    timeoutMs?: number | undefined;
    slowThresholdMs?: number | undefined;
    expectedStatuses?: number[] | null | undefined;
    schemaValidation?: boolean | undefined;
  }): void {
    if (fields.name !== undefined) this.name = fields.name;
    if (fields.baseUrl !== undefined) this.baseUrl = fields.baseUrl;
    if (fields.environment !== undefined) this.environment = fields.environment;
    if (fields.description !== undefined) this.description = fields.description;
    if (fields.tags !== undefined) this.tags = fields.tags;
    if (fields.checkIntervalMinutes !== undefined) {
      this.checkIntervalMinutes = fields.checkIntervalMinutes;
    }
    if (fields.timeoutMs !== undefined) this.timeoutMs = fields.timeoutMs;
    if (fields.slowThresholdMs !== undefined) this.slowThresholdMs = fields.slowThresholdMs;
    if (fields.expectedStatuses !== undefined) this.expectedStatuses = fields.expectedStatuses;
    if (fields.schemaValidation !== undefined) this.schemaValidation = fields.schemaValidation;
  }

  /** Called once a {@link CheckRun} completes — recomputes the aggregate status (FR-APP-06). */
  public recordCompletedRun(hadFailure: boolean, hadDegraded: boolean): void {
    if (hadFailure) {
      this.status = ApplicationStatus.DOWN;
    } else if (hadDegraded) {
      this.status = ApplicationStatus.DEGRADED;
    } else {
      this.status = ApplicationStatus.UP;
    }
  }
}
