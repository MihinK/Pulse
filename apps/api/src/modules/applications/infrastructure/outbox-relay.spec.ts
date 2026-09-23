import type { EntityManager } from "@mikro-orm/postgresql";
import { OutboxRelay } from "./outbox-relay";
import { Organization } from "../../identity/domain/organization.entity";
import { OutboxEntry } from "../domain/outbox-entry.entity";
import type { OutboxRepository } from "../application/ports/outbox-repository";
import type { Queue } from "../application/ports/queue";
import { RUN_QUEUED_KIND } from "../domain/outbox-kinds";

function buildEm(): EntityManager {
  const forkedEm = {
    getConnection: jest.fn().mockReturnValue({ execute: jest.fn().mockResolvedValue(undefined) }),
    getTransactionContext: jest.fn().mockReturnValue("tx-context"),
  };
  return {
    transactional: jest.fn(async (callback: (em: unknown) => Promise<unknown>) => callback(forkedEm)),
  } as unknown as EntityManager;
}

describe("OutboxRelay", () => {
  const org = new Organization("Acme", "acme", "UTC");

  it("does nothing when there are no unprocessed entries", async () => {
    const outbox: jest.Mocked<OutboxRepository> = {
      save: jest.fn(),
      findUnprocessed: jest.fn().mockResolvedValue([]),
      markProcessed: jest.fn(),
    };
    const queue: jest.Mocked<Queue> = { enqueue: jest.fn() };
    const relay = new OutboxRelay(buildEm(), outbox, queue);

    await relay.relay();

    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(outbox.findUnprocessed).toHaveBeenCalledWith(20, RUN_QUEUED_KIND);
  });

  it("enqueues each unprocessed entry and marks it processed", async () => {
    const entry = new OutboxEntry(org, "run.queued", { checkRunId: "run-1" });
    const outbox: jest.Mocked<OutboxRepository> = {
      save: jest.fn(),
      findUnprocessed: jest.fn().mockResolvedValue([entry]),
      markProcessed: jest.fn().mockResolvedValue(undefined),
    };
    const queue: jest.Mocked<Queue> = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const relay = new OutboxRelay(buildEm(), outbox, queue);

    await relay.relay();

    expect(queue.enqueue).toHaveBeenCalledWith("run.queued", { checkRunId: "run-1" });
    expect(entry.processedAt).toBeInstanceOf(Date);
    expect(outbox.markProcessed).toHaveBeenCalledWith(entry);
  });

  it("relays multiple entries in one pass", async () => {
    const first = new OutboxEntry(org, "run.queued", { checkRunId: "run-1" });
    const second = new OutboxEntry(org, "run.queued", { checkRunId: "run-2" });
    const outbox: jest.Mocked<OutboxRepository> = {
      save: jest.fn(),
      findUnprocessed: jest.fn().mockResolvedValue([first, second]),
      markProcessed: jest.fn().mockResolvedValue(undefined),
    };
    const queue: jest.Mocked<Queue> = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const relay = new OutboxRelay(buildEm(), outbox, queue);

    await relay.relay();

    expect(queue.enqueue).toHaveBeenCalledTimes(2);
  });
});
