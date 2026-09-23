import { Entity, PrimaryKey, Property, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { User } from "../../identity/domain/user.entity";
import { userRef, touchUpdatedAt } from "../../applications/domain/entity-refs";
import { IntegerArrayType } from "../../applications/domain/integer-array.type";
import { ApiDocument } from "./api-document.entity";
import type { ParsedEndpoint } from "./parsed-spec";

/**
 * One operation extracted from a `ParsedSpec` (technical plan section 3). Write-confirmation
 * fields (`writeEnabled`, `writeConfirmedBy`, `writeConfirmedAt`, `allowInSchedule`) exist in the
 * schema now but are only ever read/written starting sprint 5 — this sprint never sets them.
 */
@Entity({ tableName: "endpoints" })
export class Endpoint {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(() => ApiDocument, { fieldName: "api_document_id" })
  public readonly apiDocument: ApiDocument;

  @Property()
  public readonly method: string;

  @Property()
  public readonly path: string;

  @Property({ fieldName: "operation_id", nullable: true })
  public readonly operationId?: string | undefined;

  @Property({ fieldName: "expected_statuses", type: IntegerArrayType, nullable: true })
  public readonly expectedStatuses?: number[] | undefined;

  @Property({ fieldName: "response_schema", type: "json", nullable: true })
  public readonly responseSchema?: Record<string, unknown> | undefined;

  @Property({ fieldName: "sample_params", type: "json", nullable: true })
  public sampleParams?: Record<string, unknown> | undefined;

  @Property({ fieldName: "sample_body", type: "json", nullable: true })
  public sampleBody?: Record<string, unknown> | undefined;

  @Property()
  public included = true;

  @Property({ fieldName: "write_enabled" })
  public readonly writeEnabled = false;

  @ManyToOne(userRef, { fieldName: "write_confirmed_by", nullable: true })
  public readonly writeConfirmedBy?: User | undefined;

  @Property({ fieldName: "write_confirmed_at", nullable: true })
  public readonly writeConfirmedAt?: Date | undefined;

  @Property({ fieldName: "allow_in_schedule" })
  public readonly allowInSchedule = false;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "updated_at", onUpdate: touchUpdatedAt })
  public updatedAt: Date = new Date();

  @Property({ version: true })
  public readonly version: number = 1;

  public constructor(apiDocument: ApiDocument, parsed: ParsedEndpoint) {
    this.apiDocument = apiDocument;
    this.method = parsed.method;
    this.path = parsed.path;
    this.operationId = parsed.operationId;
    this.expectedStatuses = parsed.expectedStatuses;
    this.responseSchema = parsed.responseSchema;
    this.sampleParams = parsed.sampleParams;
    this.sampleBody = parsed.sampleBody;
  }

  public setIncluded(included: boolean): void {
    this.included = included;
  }

  public setSampleValues(
    sampleParams: Record<string, unknown> | undefined,
    sampleBody: Record<string, unknown> | undefined,
  ): void {
    this.sampleParams = sampleParams;
    this.sampleBody = sampleBody;
  }

  /** Preserves an Admin's setup across a re-upload — the technical plan's "carry over" step. */
  public carryOverFrom(previous: Endpoint): void {
    this.included = previous.included;
    this.sampleParams = previous.sampleParams;
    this.sampleBody = previous.sampleBody;
  }
}
