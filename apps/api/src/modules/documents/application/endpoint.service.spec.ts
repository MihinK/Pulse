import { NotFoundException } from "@nestjs/common";
import { EndpointService } from "./endpoint.service";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "../domain/api-document.entity";
import { Endpoint } from "../domain/endpoint.entity";
import { DocumentFormat } from "../domain/document-format.enum";
import type { ApiDocumentRepository } from "./ports/api-document-repository";
import type { EndpointRepository } from "./ports/endpoint-repository";

describe("EndpointService", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);

  function build() {
    const endpoints: jest.Mocked<EndpointRepository> = {
      findById: jest.fn(),
      findByApiDocumentId: jest.fn(),
      saveAll: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const apiDocuments: jest.Mocked<ApiDocumentRepository> = {
      findById: jest.fn(),
      findActiveByApplicationId: jest.fn(),
      findByApplicationId: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EndpointService(endpoints, apiDocuments);
    return { service, endpoints, apiDocuments };
  }

  it("lists endpoints for a document once the parent document is confirmed visible", async () => {
    const { service, endpoints, apiDocuments } = build();
    apiDocuments.findById.mockResolvedValue(document);
    const list = [new Endpoint(document, { method: "GET", path: "/users" })];
    endpoints.findByApiDocumentId.mockResolvedValue(list);

    await expect(service.listByDocument(document.id)).resolves.toBe(list);
    expect(apiDocuments.findById).toHaveBeenCalledWith(document.id);
  });

  it("throws 404, not an empty list, when the document isn't visible to the caller", async () => {
    const { service, apiDocuments, endpoints } = build();
    apiDocuments.findById.mockResolvedValue(null);

    await expect(service.listByDocument("missing-id")).rejects.toThrow(NotFoundException);
    expect(endpoints.findByApiDocumentId).not.toHaveBeenCalled();
  });

  it("throws 404 when patching an endpoint that doesn't exist", async () => {
    const { service, endpoints } = build();
    endpoints.findById.mockResolvedValue(null);

    await expect(service.patch("missing-id", { included: false })).rejects.toThrow(NotFoundException);
  });

  it("patches included independently of sample values", async () => {
    const { service, endpoints } = build();
    const endpoint = new Endpoint(document, { method: "GET", path: "/users" });
    endpoints.findById.mockResolvedValue(endpoint);

    await service.patch(endpoint.id, { included: false });

    expect(endpoint.included).toBe(false);
    expect(endpoints.save).toHaveBeenCalledWith(endpoint);
  });

  it("patches sample params and body together, preserving the other when only one changes", async () => {
    const { service, endpoints } = build();
    const endpoint = new Endpoint(document, { method: "GET", path: "/users" });
    endpoint.setSampleValues({ id: "1" }, { name: "a" });
    endpoints.findById.mockResolvedValue(endpoint);

    await service.patch(endpoint.id, { sampleBody: { name: "b" } });

    expect(endpoint.sampleParams).toEqual({ id: "1" });
    expect(endpoint.sampleBody).toEqual({ name: "b" });
  });
});
