import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DocumentService } from "./document.service";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "../domain/api-document.entity";
import { DocumentFormat } from "../domain/document-format.enum";
import { DOCUMENT_UPLOADED_KIND } from "../domain/outbox-kinds";
import { MAX_UPLOAD_BYTES } from "../documents.tokens";
import type { ApiDocumentRepository } from "./ports/api-document-repository";
import type { ObjectStorage } from "./ports/object-storage";
import type { SpecFormatDetector } from "./ports/spec-format-detector";
import type { ContentFetcher } from "./ports/content-fetcher";
import type { OutboxRepository } from "../../applications/application/ports/outbox-repository";

describe("DocumentService", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);

  function build() {
    const apiDocuments: jest.Mocked<ApiDocumentRepository> = {
      findById: jest.fn(),
      findActiveByApplicationId: jest.fn().mockResolvedValue(null),
      findByApplicationId: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const storage: jest.Mocked<ObjectStorage> = {
      put: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
    };
    const formatDetector: jest.Mocked<SpecFormatDetector> = {
      detect: jest.fn().mockReturnValue({ format: DocumentFormat.OPENAPI_3, parsed: {} }),
    };
    const outbox: jest.Mocked<OutboxRepository> = {
      findUnprocessed: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      markProcessed: jest.fn(),
    };
    const contentFetcher: jest.Mocked<ContentFetcher> = {
      fetch: jest.fn(),
    };
    const service = new DocumentService(apiDocuments, storage, formatDetector, outbox, contentFetcher);
    return { service, apiDocuments, storage, formatDetector, outbox, contentFetcher };
  }

  it("stores the file, creates a PENDING document, and writes an outbox row scoped to document.uploaded", async () => {
    const { service, apiDocuments, storage, outbox } = build();

    const document = await service.uploadFile(app, admin, Buffer.from("openapi: 3.0.0"));

    expect(storage.put).toHaveBeenCalledWith(
      expect.stringContaining(`applications/${app.id}/`),
      expect.any(Buffer),
      "application/octet-stream",
    );
    expect(apiDocuments.save).toHaveBeenCalledWith(document);
    expect(document.versionNo).toBe(1);
    expect(document.isActive).toBe(false);
    expect(outbox.save).toHaveBeenCalledTimes(1);
    const entry = outbox.save.mock.calls[0]?.[0];
    expect(entry?.kind).toBe(DOCUMENT_UPLOADED_KIND);
    expect(entry?.payload).toEqual({ apiDocumentId: document.id });
  });

  it("rejects uploads over the size limit before touching storage", async () => {
    const { service, storage } = build();
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1);

    await expect(service.uploadFile(app, admin, oversized)).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("rejects content in an unrecognized format", async () => {
    const { service, formatDetector } = build();
    formatDetector.detect.mockReturnValue(null);

    await expect(service.uploadFile(app, admin, Buffer.from("garbage"))).rejects.toThrow(
      BadRequestException,
    );
  });

  it("dedupes by checksum, returning the existing active document unchanged", async () => {
    const { service, apiDocuments, storage } = build();
    const content = Buffer.from("openapi: 3.0.0");
    const existing = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "", admin);
    // Force the checksum to match what the service computes for `content`.
    const checksum = createHash("sha256").update(content).digest("hex");
    Object.defineProperty(existing, "checksum", { value: checksum });
    apiDocuments.findActiveByApplicationId.mockResolvedValue(existing);

    const result = await service.uploadFile(app, admin, content);

    expect(result).toBe(existing);
    expect(storage.put).not.toHaveBeenCalled();
    expect(apiDocuments.save).not.toHaveBeenCalled();
  });

  it("numbers a new version one past the highest existing version", async () => {
    const { service, apiDocuments } = build();
    apiDocuments.findByApplicationId.mockResolvedValue([
      new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin),
      new ApiDocument(app, DocumentFormat.OPENAPI_3, 2, "key-2", "sum-2", admin),
    ]);

    const document = await service.uploadFile(app, admin, Buffer.from("openapi: 3.0.0"));

    expect(document.versionNo).toBe(3);
  });

  it("imports from a URL via the content fetcher", async () => {
    const { service, contentFetcher, apiDocuments } = build();
    contentFetcher.fetch.mockResolvedValue(Buffer.from("openapi: 3.0.0"));

    const document = await service.importFromUrl(app, admin, "https://example.test/spec.yaml");

    expect(contentFetcher.fetch).toHaveBeenCalledWith("https://example.test/spec.yaml", MAX_UPLOAD_BYTES);
    expect(apiDocuments.save).toHaveBeenCalledWith(document);
  });

  it("lists version history for an application", async () => {
    const { service, apiDocuments } = build();
    const versions = [new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin)];
    apiDocuments.findByApplicationId.mockResolvedValue(versions);

    await expect(service.listVersions(app.id)).resolves.toBe(versions);
    expect(apiDocuments.findByApplicationId).toHaveBeenCalledWith(app.id);
  });
});
