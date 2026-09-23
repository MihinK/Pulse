import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmEndpointRepository } from "./mikroorm-endpoint.repository";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "../domain/api-document.entity";
import { Endpoint } from "../domain/endpoint.entity";
import { DocumentFormat } from "../domain/document-format.enum";

function build() {
  const persisted: Endpoint[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (endpoint: Endpoint): void => {
      persisted.push(endpoint);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    findOne: jest.fn(),
    find: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<Endpoint>;
  return { repository: new MikroOrmEndpointRepository(underlying), underlying, persisted, flushCount };
}

describe("MikroOrmEndpointRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);
  const endpoint = new Endpoint(document, { method: "GET", path: "/users" });

  it("finds by id", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(endpoint);

    const result = await repository.findById(endpoint.id);

    expect(underlying.findOne).toHaveBeenCalledWith({ id: endpoint.id });
    expect(result).toBe(endpoint);
  });

  it("finds endpoints for a document, ordered by path then method", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([endpoint]);

    await repository.findByApiDocumentId(document.id);

    expect(underlying.find).toHaveBeenCalledWith(
      { apiDocument: document.id },
      { orderBy: { path: "asc", method: "asc" } },
    );
  });

  it("persists and flushes all endpoints on saveAll", async () => {
    const { repository, persisted, flushCount } = build();
    const other = new Endpoint(document, { method: "POST", path: "/users" });

    await repository.saveAll([endpoint, other]);

    expect(persisted).toEqual([endpoint, other]);
    expect(flushCount.value).toBe(1);
  });

  it("persists and flushes on save", async () => {
    const { repository, persisted, flushCount } = build();

    await repository.save(endpoint);

    expect(persisted).toEqual([endpoint]);
    expect(flushCount.value).toBe(1);
  });
});
