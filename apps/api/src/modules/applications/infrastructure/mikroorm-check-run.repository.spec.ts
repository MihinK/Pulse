import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmCheckRunRepository } from "./mikroorm-check-run.repository";
import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { CheckRun } from "../domain/check-run.entity";
import { CheckTrigger } from "../domain/check-trigger.enum";

function build() {
  const persisted: CheckRun[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (run: CheckRun): void => {
      persisted.push(run);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    findOne: jest.fn(),
    find: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<CheckRun>;
  return { repository: new MikroOrmCheckRunRepository(underlying), underlying, persisted, flushCount };
}

describe("MikroOrmCheckRunRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const run = new CheckRun(org, app, CheckTrigger.MANUAL);

  it("finds by id", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(run);

    const result = await repository.findById(run.id);

    expect(underlying.findOne).toHaveBeenCalledWith({ id: run.id });
    expect(result).toBe(run);
  });

  it("finds by application id with a default limit", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([run]);

    await repository.findByApplicationId(app.id);

    expect(underlying.find).toHaveBeenCalledWith(
      { application: app.id },
      { orderBy: { createdAt: "desc" }, limit: 20 },
    );
  });

  it("finds by application id with a custom limit", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([]);

    await repository.findByApplicationId(app.id, 5);

    expect(underlying.find).toHaveBeenCalledWith(
      { application: app.id },
      { orderBy: { createdAt: "desc" }, limit: 5 },
    );
  });

  it("persists and flushes on save", async () => {
    const { repository, persisted, flushCount } = build();

    await repository.save(run);

    expect(persisted).toEqual([run]);
    expect(flushCount.value).toBe(1);
  });
});
