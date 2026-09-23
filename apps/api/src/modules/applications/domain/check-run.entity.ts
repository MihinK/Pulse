import { Entity, PrimaryKey, Property, Enum, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { CheckRunStatus } from "@pulse/shared";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Application } from "./application.entity";
import { CheckTrigger } from "./check-trigger.enum";
import { organizationRef, touchUpdatedAt, userRef } from "./entity-refs";

/**
 * `apiDocumentId` is a plain nullable uuid (no relation) — there is no `ApiDocument` entity until
 * sprint 5, matching {@link Application.expectedStatuses}'s "column exists, unused" precedent.
 */
@Entity({ tableName: "check_runs" })
export class CheckRun {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(organizationRef, { fieldName: "organization_id" })
  public readonly organization: Organization;

  @Index()
  @ManyToOne(() => Application, { fieldName: "application_id" })
  public readonly application: Application;

  @Property({ fieldName: "api_document_id", type: "uuid", nullable: true })
  public readonly apiDocumentId?: string;

  @Enum(() => CheckTrigger)
  public readonly trigger: CheckTrigger;

  @ManyToOne(userRef, { fieldName: "triggered_by", nullable: true })
  public readonly triggeredBy?: User | undefined;

  @Enum(() => CheckRunStatus)
  public status: CheckRunStatus = CheckRunStatus.QUEUED;

  @Property({ fieldName: "started_at", nullable: true })
  public startedAt?: Date;

  @Property({ fieldName: "finished_at", nullable: true })
  public finishedAt?: Date;

  @Property()
  public total = 0;

  @Property()
  public passed = 0;

  @Property()
  public failed = 0;

  @Property()
  public skipped = 0;

  // `runtimeType: 'number'` is explicit because `avgMs?: number | undefined`'s union type makes
  // TS emit `Object` for the decorator's reflected design type — without this, DecimalType falls
  // back to returning the raw numeric column as a string instead of converting it.
  @Property({ fieldName: "avg_ms", type: "decimal", runtimeType: "number", nullable: true })
  public avgMs?: number | undefined;

  @Property({ fieldName: "p95_ms", type: "decimal", runtimeType: "number", nullable: true })
  public p95Ms?: number | undefined;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "updated_at", onUpdate: touchUpdatedAt })
  public updatedAt: Date = new Date();

  @Property({ version: true })
  public readonly version: number = 1;

  public constructor(
    organization: Organization,
    application: Application,
    trigger: CheckTrigger,
    triggeredBy?: User,
  ) {
    this.organization = organization;
    this.application = application;
    this.trigger = trigger;
    this.triggeredBy = triggeredBy;
  }

  public start(now: Date): void {
    this.status = CheckRunStatus.RUNNING;
    this.startedAt = now;
  }

  /** Summarises a completed batch of {@link CheckResult}s and marks the run COMPLETED. */
  public complete(
    now: Date,
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      avgMs?: number | undefined;
      p95Ms?: number | undefined;
    },
  ): void {
    this.status = CheckRunStatus.COMPLETED;
    this.finishedAt = now;
    this.total = summary.total;
    this.passed = summary.passed;
    this.failed = summary.failed;
    this.skipped = summary.skipped;
    this.avgMs = summary.avgMs;
    this.p95Ms = summary.p95Ms;
  }

  public fail(now: Date): void {
    this.status = CheckRunStatus.FAILED;
    this.finishedAt = now;
  }

  public hadFailure(): boolean {
    return this.failed > 0;
  }
}
