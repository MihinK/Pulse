import type { OutboxEntry } from "../../domain/outbox-entry.entity";

export interface OutboxRepository {
  save(entry: OutboxEntry): Promise<void>;
  /**
   * Read under `bypass_rls` (see `OutboxRelay`) — a relay poller has no single organisation.
   * `kind` is required, not optional: the `outbox` table is shared across every module that
   * needs "commit DB + enqueue a job" atomicity (ADR-002), each with its own relay and its own
   * downstream queue — an unscoped read would hand one module's rows to another's relay.
   */
  findUnprocessed(limit: number, kind: string): Promise<OutboxEntry[]>;
  markProcessed(entry: OutboxEntry): Promise<void>;
}
