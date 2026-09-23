import { ApiProperty } from "@nestjs/swagger";
import type { ApiDocument } from "../../domain/api-document.entity";
import { DocumentFormat } from "../../domain/document-format.enum";
import { DocumentStatus } from "../../domain/document-status.enum";

export class ApiDocumentResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly applicationId!: string;

  @ApiProperty({ enum: DocumentFormat })
  public readonly format!: DocumentFormat;

  @ApiProperty({ required: false })
  public readonly specVersion?: string;

  @ApiProperty()
  public readonly versionNo!: number;

  @ApiProperty()
  public readonly isActive!: boolean;

  @ApiProperty({ enum: DocumentStatus })
  public readonly status!: DocumentStatus;

  @ApiProperty({ required: false })
  public readonly failureReason?: string;

  @ApiProperty()
  public readonly uploadedByUserId!: string;

  @ApiProperty()
  public readonly createdAt!: string;

  @ApiProperty()
  public readonly updatedAt!: string;

  public static fromDomain(document: ApiDocument): ApiDocumentResponseDto {
    const dto = new ApiDocumentResponseDto();
    const target = dto as {
      id: string;
      applicationId: string;
      format: DocumentFormat;
      specVersion?: string;
      versionNo: number;
      isActive: boolean;
      status: DocumentStatus;
      failureReason?: string;
      uploadedByUserId: string;
      createdAt: string;
      updatedAt: string;
    };
    target.id = document.id;
    target.applicationId = document.applicationId();
    target.format = document.format;
    // MikroORM hydrates a NULL column as `null`, not `undefined` — loose `!= null` catches both.
    if (document.specVersion != null) target.specVersion = document.specVersion;
    target.versionNo = document.versionNo;
    target.isActive = document.isActive;
    target.status = document.status;
    if (document.failureReason != null) target.failureReason = document.failureReason;
    target.uploadedByUserId = document.uploadedBy.id;
    target.createdAt = document.createdAt.toISOString();
    target.updatedAt = document.updatedAt.toISOString();
    return dto;
  }
}
