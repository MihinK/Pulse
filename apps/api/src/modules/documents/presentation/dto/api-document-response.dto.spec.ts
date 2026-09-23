import { ApiDocumentResponseDto } from "./api-document-response.dto";
import { Organization } from "../../../identity/domain/organization.entity";
import { User } from "../../../identity/domain/user.entity";
import { Role } from "../../../identity/domain/role.enum";
import { Application } from "../../../applications/domain/application.entity";
import { Environment } from "../../../applications/domain/environment.enum";
import { ApiDocument } from "../../domain/api-document.entity";
import { DocumentFormat } from "../../domain/document-format.enum";
import { DocumentStatus } from "../../domain/document-status.enum";

describe("ApiDocumentResponseDto.fromDomain", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);

  it("maps a freshly uploaded, still-PENDING document without a spec version or failure reason", () => {
    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);

    const dto = ApiDocumentResponseDto.fromDomain(document);

    expect(dto.id).toBe(document.id);
    expect(dto.applicationId).toBe(app.id);
    expect(dto.format).toBe(DocumentFormat.OPENAPI_3);
    expect(dto.versionNo).toBe(1);
    expect(dto.isActive).toBe(false);
    expect(dto.status).toBe(DocumentStatus.PENDING);
    expect(dto.specVersion).toBeUndefined();
    expect(dto.failureReason).toBeUndefined();
    expect(dto.uploadedByUserId).toBe(admin.id);
    expect(dto.createdAt).toBe(document.createdAt.toISOString());
  });

  it("maps a READY, active document with its spec version", () => {
    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
    document.activate();
    document.markReady("3.0.1");

    const dto = ApiDocumentResponseDto.fromDomain(document);

    expect(dto.isActive).toBe(true);
    expect(dto.status).toBe(DocumentStatus.READY);
    expect(dto.specVersion).toBe("3.0.1");
  });

  it("maps a FAILED document with its failure reason", () => {
    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
    document.markFailed("external $ref not allowed");

    const dto = ApiDocumentResponseDto.fromDomain(document);

    expect(dto.status).toBe(DocumentStatus.FAILED);
    expect(dto.failureReason).toBe("external $ref not allowed");
  });
});
