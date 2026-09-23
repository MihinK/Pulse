import type { OutboxEntry } from "../../domain/outbox-entry.entity";

export interface OutboxRepository {
  save(entry: OutboxEntry): Promise<void>;
  /** Read under `bypass_rls` (see `OutboxRelay`) — a relay poller has no single organisation. */
  findUnprocessed(limit: number): Promise<OutboxEntry[]>;
  markProcessed(entry: OutboxEntry): Promise<void>;
}
