import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmApiDocumentRepository } from "./mikroorm-api-document.repository";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../../applications/domain/application.entity";
import { Environment } from "../../applications/domain/environment.enum";
import { ApiDocument } from "../domain/api-document.entity";
import { DocumentFormat } from "../domain/document-format.enum";

function build() {
  const persisted: ApiDocument[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (doc: ApiDocument): void => {
      persisted.push(doc);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    findOne: jest.fn(),
    find: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<ApiDocument>;
  return { repository: new MikroOrmApiDocumentRepository(underlying), underlying, persisted, flushCount };
}

describe("MikroOrmApiDocumentRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const document = new ApiDocument(app, DocumentFormat.OPENAPI_3, 1, "key-1", "sum-1", admin);

  it("finds by id", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(document);

    const result = await repository.findById(document.id);

    expect(underlying.findOne).toHaveBeenCalledWith({ id: document.id });
    expect(result).toBe(document);
  });

  it("finds the active document for an application", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(document);

    const result = await repository.findActiveByApplicationId(app.id);

    expect(underlying.findOne).toHaveBeenCalledWith({ application: app.id, isActive: true });
    expect(result).toBe(document);
  });

  it("finds version history newest first", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([document]);

    await repository.findByApplicationId(app.id);

    expect(underlying.find).toHaveBeenCalledWith({ application: app.id }, { orderBy: { versionNo: "desc" } });
  });

  it("persists and flushes on save", async () => {
    const { repository, persisted, flushCount } = build();

    await repository.save(document);

    expect(persisted).toEqual([document]);
    expect(flushCount.value).toBe(1);
  });
});
