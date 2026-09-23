import { Entity, PrimaryKey, Property, Enum, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { Outcome } from "@pulse/shared";
import { CheckRun } from "./check-run.entity";

/**
 * `endpointId` is a plain nullable uuid (no relation) — there is no `Endpoint` entity until
 * sprint 5, same "column exists, unused" precedent as {@link CheckRun.apiDocumentId}. No
 * `organizationId`/version/updated_at columns — matches the technical plan's data model exactly;
 * RLS scopes this table transitively through `check_runs` (see the RLS migration).
 */
@Entity({ tableName: "check_results" })
export class CheckResult {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(() => CheckRun, { fieldName: "check_run_id" })
  public readonly checkRun: CheckRun;

  @Property({ fieldName: "endpoint_id", type: "uuid", nullable: true })
  public readonly endpointId?: string;

  @Property()
  public readonly method: string = "GET";

  @Property()
  public readonly url: string;

  @Property({ fieldName: "status_code", nullable: true })
  public readonly statusCode?: number | undefined;

  @Property({ fieldName: "response_ms", nullable: true })
  public readonly responseMs?: number | undefined;

  @Enum(() => Outcome)
  public readonly outcome: Outcome;

  @Property({ fieldName: "failure_reason", nullable: true })
  public readonly failureReason?: string | undefined;

  @Property({ fieldName: "checked_at" })
  public readonly checkedAt: Date = new Date();

  public constructor(
    checkRun: CheckRun,
    url: string,
    outcome: Outcome,
    fields: {
      statusCode?: number | undefined;
      responseMs?: number | undefined;
      failureReason?: string | undefined;
      method?: string | undefined;
    } = {},
  ) {
    this.checkRun = checkRun;
    this.url = url;
    this.outcome = outcome;
    this.statusCode = fields.statusCode;
    this.responseMs = fields.responseMs;
    this.failureReason = fields.failureReason;
    this.method = fields.method ?? "GET";
  }
}
