import type { EntityRepository } from "@mikro-orm/postgresql";
import { Outcome } from "@pulse/shared";
import { MikroOrmCheckResultRepository } from "./mikroorm-check-result.repository";
import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { CheckRun } from "../domain/check-run.entity";
import { CheckTrigger } from "../domain/check-trigger.enum";
import { CheckResult } from "../domain/check-result.entity";

function build() {
  const persisted: CheckResult[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (result: CheckResult): void => {
      persisted.push(result);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    find: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<CheckResult>;
  return { repository: new MikroOrmCheckResultRepository(underlying), underlying, persisted, flushCount };
}

describe("MikroOrmCheckResultRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const run = new CheckRun(org, app, CheckTrigger.MANUAL);
  const result = new CheckResult(run, app.baseUrl, Outcome.PASSED, { statusCode: 200, responseMs: 10 });

  it("finds by check run id", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([result]);

    const results = await repository.findByCheckRunId(run.id);

    expect(underlying.find).toHaveBeenCalledWith({ checkRun: run.id }, { orderBy: { checkedAt: "asc" } });
    expect(results).toEqual([result]);
  });

  it("persists and flushes every result on saveAll", async () => {
    const { repository, persisted, flushCount } = build();
    const other = new CheckResult(run, app.baseUrl, Outcome.FAILED, { failureReason: "timeout" });

    await repository.saveAll([result, other]);

    expect(persisted).toEqual([result, other]);
    expect(flushCount.value).toBe(1);
  });
});
