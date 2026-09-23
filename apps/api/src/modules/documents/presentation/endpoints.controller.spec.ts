import { DocumentEndpointsController, EndpointsController } from "./endpoints.controller";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "../domain/api-document.entity";
import { Endpoint } from "../domain/endpoint.entity";
import { DocumentFormat } from "../domain/document-format.enum";
import type { EndpointService } from "../application/endpoint.service";

describe("DocumentEndpointsController", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
  const endpoint = new Endpoint(document, { method: "GET", path: "/users" });

  it("lists endpoints for a document", async () => {
    const endpoints = {
      listByDocument: jest.fn().mockResolvedValue([endpoint]),
    } as unknown as jest.Mocked<EndpointService>;
    const controller = new DocumentEndpointsController(endpoints);

    const dtos = await controller.list(document.id);

    expect(endpoints.listByDocument).toHaveBeenCalledWith(document.id);
    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.id).toBe(endpoint.id);
  });
});

describe("EndpointsController", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
  const endpoint = new Endpoint(document, { method: "GET", path: "/users" });

  it("patches an endpoint and returns the updated DTO", async () => {
    const endpoints = {
      patch: jest.fn().mockResolvedValue(endpoint),
    } as unknown as jest.Mocked<EndpointService>;
    const controller = new EndpointsController(endpoints);

    const dto = await controller.patch(endpoint.id, { included: false });

    expect(endpoints.patch).toHaveBeenCalledWith(endpoint.id, { included: false });
    expect(dto.id).toBe(endpoint.id);
  });
});
