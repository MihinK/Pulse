import { EndpointResponseDto } from "./endpoint-response.dto";
import { Organization } from "../../../identity/domain/organization.entity";
import { User } from "../../../identity/domain/user.entity";
import { Role } from "../../../identity/domain/role.enum";
import { Application } from "../../../applications/domain/application.entity";
import { Environment } from "../../../applications/domain/environment.enum";
import { ApiDocument } from "../../domain/api-document.entity";
import { Endpoint } from "../../domain/endpoint.entity";
import { DocumentFormat } from "../../domain/document-format.enum";

describe("EndpointResponseDto.fromDomain", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);

  it("maps a bare endpoint with only the required fields", () => {
    const endpoint = new Endpoint(document, { method: "GET", path: "/users" });

    const dto = EndpointResponseDto.fromDomain(endpoint);

    expect(dto.id).toBe(endpoint.id);
    expect(dto.apiDocumentId).toBe(document.id);
    expect(dto.method).toBe("GET");
    expect(dto.path).toBe("/users");
    expect(dto.included).toBe(true);
    expect(dto.writeEnabled).toBe(false);
    expect(dto.allowInSchedule).toBe(false);
    expect(dto.operationId).toBeUndefined();
    expect(dto.expectedStatuses).toBeUndefined();
    expect(dto.responseSchema).toBeUndefined();
    expect(dto.sampleParams).toBeUndefined();
    expect(dto.sampleBody).toBeUndefined();
  });

  it("maps every optional field when the parsed spec provided them", () => {
    const endpoint = new Endpoint(document, {
      method: "POST",
      path: "/users",
      operationId: "createUser",
      expectedStatuses: [201],
      responseSchema: { type: "object" },
      sampleParams: { id: "1" },
      sampleBody: { name: "Ada" },
    });

    const dto = EndpointResponseDto.fromDomain(endpoint);

    expect(dto.operationId).toBe("createUser");
    expect(dto.expectedStatuses).toEqual([201]);
    expect(dto.responseSchema).toEqual({ type: "object" });
    expect(dto.sampleParams).toEqual({ id: "1" });
    expect(dto.sampleBody).toEqual({ name: "Ada" });
  });
});
