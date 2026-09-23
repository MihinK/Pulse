import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmApplicationRepository } from "./mikroorm-application.repository";
import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { ApplicationStatus } from "../domain/application-status.enum";

function build() {
  const persisted: Application[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (app: Application): void => {
      persisted.push(app);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    findOne: jest.fn(),
    find: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<Application>;
  return { repository: new MikroOrmApplicationRepository(underlying), underlying, persisted, flushCount };
}

describe("MikroOrmApplicationRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

  it("finds by id", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(app);

    const result = await repository.findById(app.id);

    expect(underlying.findOne).toHaveBeenCalledWith({ id: app.id });
    expect(result).toBe(app);
  });

  it("finds all, excluding soft-deleted, with no filter", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([app]);

    await repository.findAll();

    expect(underlying.find).toHaveBeenCalledWith({ deletedAt: null }, { orderBy: { createdAt: "desc" } });
  });

  it("applies status, environment, and search filters", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([]);

    await repository.findAll({ status: ApplicationStatus.UP, environment: Environment.PROD, search: "api" });

    expect(underlying.find).toHaveBeenCalledWith(
      { deletedAt: null, status: ApplicationStatus.UP, environment: Environment.PROD, name: { $ilike: "%api%" } },
      { orderBy: { createdAt: "desc" } },
    );
  });

  it("persists and flushes on save", async () => {
    const { repository, persisted, flushCount } = build();

    await repository.save(app);

    expect(persisted).toEqual([app]);
    expect(flushCount.value).toBe(1);
  });
});
