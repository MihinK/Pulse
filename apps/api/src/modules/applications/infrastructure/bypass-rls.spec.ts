import type { EntityManager } from "@mikro-orm/postgresql";
import { runWithBypassRls } from "./bypass-rls";

describe("runWithBypassRls", () => {
  it("sets app.bypass_rls on a fresh transaction and runs the callback inside it", async () => {
    const executeMock = jest.fn().mockResolvedValue(undefined);
    const forkedEm = {
      getConnection: jest.fn().mockReturnValue({ execute: executeMock }),
      getTransactionContext: jest.fn().mockReturnValue("tx-context"),
    };
    const em = {
      transactional: jest.fn(async (callback: (em: unknown) => Promise<unknown>) => callback(forkedEm)),
    } as unknown as EntityManager;

    const result = await runWithBypassRls(em, async () => "done");

    expect(em.transactional).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledWith(
      "select set_config('app.bypass_rls', 'true', true)",
      [],
      "all",
      "tx-context",
    );
    expect(result).toBe("done");
  });
});
