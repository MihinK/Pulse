import { Entity, PrimaryKey, Property, Enum, ManyToOne, Index } from "@mikro-orm/core";
import { v7 as uuidv7 } from "uuid";
import { Application } from "../../applications/domain/application.entity";
import { User } from "../../identity/domain/user.entity";
import { userRef, touchUpdatedAt } from "../../applications/domain/entity-refs";
import { DocumentFormat } from "./document-format.enum";
import { DocumentStatus } from "./document-status.enum";

/**
 * A single uploaded/imported version of an application's API spec. `isActive` marks the version
 * currently in force — enforced by a partial unique index (`WHERE is_active`) in the migration,
 * not just application code. Raw bytes live in object storage (`storageKey`); this row is the
 * metadata plus, once parsed, the `Endpoint` rows below it.
 */
@Entity({ tableName: "api_documents" })
export class ApiDocument {
  @PrimaryKey({ type: "uuid" })
  public readonly id: string = uuidv7();

  @Index()
  @ManyToOne(() => Application, { fieldName: "application_id" })
  public readonly application: Application;

  @Enum(() => DocumentFormat)
  public readonly format: DocumentFormat;

  // Mutable, not constructor-only: this is the *spec's own* declared version (e.g. "3.0.1"), only
  // known once the worker actually parses the document — `DocumentService` only detects the
  // *format* synchronously (cheap); full validation/parsing is the "worker with a time limit"
  // step (technical plan's security table), so this stays unset until `markReady()` time.
  @Property({ fieldName: "spec_version", nullable: true })
  public specVersion?: string | undefined;

  @Property({ fieldName: "version_no" })
  public readonly versionNo: number;

  @Property({ fieldName: "storage_key" })
  public readonly storageKey: string;

  @Property()
  public readonly checksum: string;

  @Property({ fieldName: "is_active" })
  public isActive = false;

  @Enum(() => DocumentStatus)
  public status: DocumentStatus = DocumentStatus.PENDING;

  @Property({ fieldName: "failure_reason", nullable: true })
  public failureReason?: string | undefined;

  @ManyToOne(userRef, { fieldName: "uploaded_by" })
  public readonly uploadedBy: User;

  @Property({ fieldName: "created_at" })
  public readonly createdAt: Date = new Date();

  @Property({ fieldName: "updated_at", onUpdate: touchUpdatedAt })
  public updatedAt: Date = new Date();

  @Property({ version: true })
  public readonly version: number = 1;

  public constructor(
    application: Application,
    format: DocumentFormat,
    versionNo: number,
    storageKey: string,
    checksum: string,
    uploadedBy: User,
  ) {
    this.application = application;
    this.format = format;
    this.versionNo = versionNo;
    this.storageKey = storageKey;
    this.checksum = checksum;
    this.uploadedBy = uploadedBy;
  }

  public applicationId(): string {
    return this.application.id;
  }

  public activate(): void {
    this.isActive = true;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public markReady(specVersion?: string): void {
    this.status = DocumentStatus.READY;
    this.failureReason = undefined;
    this.specVersion = specVersion;
  }

  public markFailed(reason: string): void {
    this.status = DocumentStatus.FAILED;
    this.failureReason = reason;
  }
}
