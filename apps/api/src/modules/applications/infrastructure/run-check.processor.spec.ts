import type { EntityManager } from "@mikro-orm/postgresql";
import type { Job } from "bullmq";
import { RunCheckProcessor } from "./run-check.processor";
import type { RunCheckService } from "../application/run-check.service";

function buildEm(): EntityManager {
  const forkedEm = {
    getConnection: jest.fn().mockReturnValue({ execute: jest.fn().mockResolvedValue(undefined) }),
    getTransactionContext: jest.fn().mockReturnValue("tx-context"),
  };
  return {
    transactional: jest.fn(async (callback: (em: unknown) => Promise<unknown>) => callback(forkedEm)),
  } as unknown as EntityManager;
}

describe("RunCheckProcessor", () => {
  it("executes the run check inside a bypass_rls transaction", async () => {
    const runCheckService = { execute: jest.fn().mockResolvedValue(undefined) } as unknown as RunCheckService;
    const em = buildEm();
    const processor = new RunCheckProcessor(em, runCheckService);
    const job = { data: { checkRunId: "run-1" } } as Job<{ checkRunId: string }>;

    await processor.process(job);

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(runCheckService.execute).toHaveBeenCalledWith("run-1");
  });
});
