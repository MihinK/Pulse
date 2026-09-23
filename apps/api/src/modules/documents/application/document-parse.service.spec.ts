import { DocumentParseService } from "./document-parse.service";
import { SpecValidationError } from "./ports/spec-parser";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "../domain/api-document.entity";
import { Endpoint } from "../domain/endpoint.entity";
import { DocumentFormat } from "../domain/document-format.enum";
import { DocumentStatus } from "../domain/document-status.enum";
import type { ApiDocumentRepository } from "./ports/api-document-repository";
import type { EndpointRepository } from "./ports/endpoint-repository";
import type { ObjectStorage } from "./ports/object-storage";
import type { SpecFormatDetector } from "./ports/spec-format-detector";
import type { SpecParser } from "./ports/spec-parser";
import type { SpecParserFactory } from "../infrastructure/spec-parser.factory";

describe("DocumentParseService", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);

  function build() {
    const apiDocuments: jest.Mocked<ApiDocumentRepository> = {
      findById: jest.fn(),
      findActiveByApplicationId: jest.fn().mockResolvedValue(null),
      findByApplicationId: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const endpoints: jest.Mocked<EndpointRepository> = {
      findById: jest.fn(),
      findByApiDocumentId: jest.fn().mockResolvedValue([]),
      saveAll: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const storage: jest.Mocked<ObjectStorage> = {
      put: jest.fn(),
      get: jest.fn().mockResolvedValue(Buffer.from("openapi: 3.0.0")),
    };
    const formatDetector: jest.Mocked<SpecFormatDetector> = {
      detect: jest.fn().mockReturnValue({ format: DocumentFormat.OPENAPI_3, parsed: {} }),
    };
    const parser: jest.Mocked<SpecParser> = {
      parse: jest.fn().mockResolvedValue({
        endpoints: [{ method: "GET", path: "/users" }],
        specVersion: "3.0.1",
      }),
    };
    const parsers = { forFormat: jest.fn().mockReturnValue(parser) } as unknown as jest.Mocked<SpecParserFactory>;
    const service = new DocumentParseService(apiDocuments, endpoints, storage, formatDetector, parsers);
    return { service, apiDocuments, endpoints, storage, formatDetector, parser, parsers };
  }

  it("does nothing when the document no longer exists", async () => {
    const { service, apiDocuments, storage } = build();
    apiDocuments.findById.mockResolvedValue(null);

    await service.execute("missing-id");

    expect(storage.get).not.toHaveBeenCalled();
  });

  it("parses, creates endpoints, and marks the document ready and active when there's no previous version", async () => {
    const { service, apiDocuments, endpoints } = build();
    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
    apiDocuments.findById.mockResolvedValue(document);

    await service.execute(document.id);

    expect(document.status).toBe(DocumentStatus.READY);
    expect(document.specVersion).toBe("3.0.1");
    expect(document.isActive).toBe(true);
    expect(endpoints.saveAll).toHaveBeenCalledTimes(1);
    const saved = endpoints.saveAll.mock.calls[0]?.[0] as Endpoint[];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.path).toBe("/users");
    expect(apiDocuments.save).toHaveBeenCalledWith(document);
  });

  it("carries over included/sample values from the previous active version by method+path, then deactivates it", async () => {
    const { service, apiDocuments, endpoints } = build();
    const previous = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
    previous.activate();
    const previousEndpoint = new Endpoint(previous, { method: "GET", path: "/users" });
    previousEndpoint.setIncluded(false);
    previousEndpoint.setSampleValues({ id: "1" }, undefined);
    endpoints.findByApiDocumentId.mockResolvedValue([previousEndpoint]);

    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 2, "key-2", "sum-2", admin);
    apiDocuments.findById.mockResolvedValue(document);
    apiDocuments.findActiveByApplicationId.mockResolvedValue(previous);

    await service.execute(document.id);

    const saved = endpoints.saveAll.mock.calls[0]?.[0] as Endpoint[];
    expect(saved[0]?.included).toBe(false);
    expect(saved[0]?.sampleParams).toEqual({ id: "1" });
    expect(previous.isActive).toBe(false);
    expect(apiDocuments.save).toHaveBeenCalledWith(previous);
    expect(document.isActive).toBe(true);
  });

  it("does not carry over or deactivate when the 'previous active' document is itself the one being parsed", async () => {
    const { service, apiDocuments, endpoints } = build();
    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
    apiDocuments.findById.mockResolvedValue(document);
    apiDocuments.findActiveByApplicationId.mockResolvedValue(document);

    await service.execute(document.id);

    expect(endpoints.findByApiDocumentId).not.toHaveBeenCalled();
  });

  it("marks the document failed, without touching endpoints, when the format can't be detected", async () => {
    const { service, apiDocuments, endpoints, formatDetector } = build();
    formatDetector.detect.mockReturnValue(null);
    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
    apiDocuments.findById.mockResolvedValue(document);

    await service.execute(document.id);

    expect(document.status).toBe(DocumentStatus.FAILED);
    expect(document.failureReason).toContain("Unrecognized spec format");
    expect(endpoints.saveAll).not.toHaveBeenCalled();
  });

  it("marks the document failed with the parser's message when parsing throws", async () => {
    const { service, apiDocuments, parser } = build();
    parser.parse.mockRejectedValue(new SpecValidationError("external $ref not allowed"));
    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
    apiDocuments.findById.mockResolvedValue(document);

    await service.execute(document.id);

    expect(document.status).toBe(DocumentStatus.FAILED);
    expect(document.failureReason).toBe("external $ref not allowed");
  });

  it("stringifies a non-Error rejection as the failure reason", async () => {
    const { service, apiDocuments, parser } = build();
    parser.parse.mockRejectedValue("boom");
    const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
    apiDocuments.findById.mockResolvedValue(document);

    await service.execute(document.id);

    expect(document.failureReason).toBe("boom");
  });
});
