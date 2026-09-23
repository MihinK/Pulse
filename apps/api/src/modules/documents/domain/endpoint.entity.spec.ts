import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "./api-document.entity";
import { DocumentFormat } from "./document-format.enum";
import { Endpoint } from "./endpoint.entity";

describe("Endpoint", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const doc = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key", "checksum", admin);

  it("builds from a ParsedEndpoint, defaulting to included", () => {
    const endpoint = new Endpoint(doc, {
      method: "GET",
      path: "/users/{id}",
      operationId: "getUser",
      expectedStatuses: [200],
    });

    expect(endpoint.method).toBe("GET");
    expect(endpoint.path).toBe("/users/{id}");
    expect(endpoint.operationId).toBe("getUser");
    expect(endpoint.included).toBe(true);
    expect(endpoint.writeEnabled).toBe(false);
  });

  it("toggles included", () => {
    const endpoint = new Endpoint(doc, { method: "GET", path: "/users" });

    endpoint.setIncluded(false);

    expect(endpoint.included).toBe(false);
  });

  it("sets sample values", () => {
    const endpoint = new Endpoint(doc, { method: "GET", path: "/users/{id}" });

    endpoint.setSampleValues({ id: "123" }, undefined);

    expect(endpoint.sampleParams).toEqual({ id: "123" });
    expect(endpoint.sampleBody).toBeUndefined();
  });

  it("carries over include/sample values from a previous version's matching endpoint", () => {
    const previous = new Endpoint(doc, { method: "GET", path: "/users/{id}" });
    previous.setIncluded(false);
    previous.setSampleValues({ id: "42" }, { note: "carried" });

    const next = new Endpoint(doc, { method: "GET", path: "/users/{id}" });
    next.carryOverFrom(previous);

    expect(next.included).toBe(false);
    expect(next.sampleParams).toEqual({ id: "42" });
    expect(next.sampleBody).toEqual({ note: "carried" });
  });
});
