import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmOutboxRepository } from "./mikroorm-outbox.repository";
import { Organization } from "../../identity/domain/organization.entity";
import { OutboxEntry } from "../domain/outbox-entry.entity";

function build() {
  const persisted: OutboxEntry[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (entry: OutboxEntry): void => {
      persisted.push(entry);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    find: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<OutboxEntry>;
  return { repository: new MikroOrmOutboxRepository(underlying), underlying, persisted, flushCount };
}

describe("MikroOrmOutboxRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const entry = new OutboxEntry(org, "run.queued", { checkRunId: "run-1" });

  it("finds unprocessed entries oldest first, up to the limit", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([entry]);

    const results = await repository.findUnprocessed(10);

    expect(underlying.find).toHaveBeenCalledWith(
      { processedAt: null },
      { orderBy: { createdAt: "asc" }, limit: 10 },
    );
    expect(results).toEqual([entry]);
  });

  it("persists and flushes on save", async () => {
    const { repository, persisted, flushCount } = build();

    await repository.save(entry);

    expect(persisted).toEqual([entry]);
    expect(flushCount.value).toBe(1);
  });

  it("persists and flushes on markProcessed", async () => {
    const { repository, persisted, flushCount } = build();
    entry.markProcessed(new Date());

    await repository.markProcessed(entry);

    expect(persisted).toEqual([entry]);
    expect(flushCount.value).toBe(1);
  });
});
