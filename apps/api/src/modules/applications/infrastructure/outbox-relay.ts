import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { EntityManager } from "@mikro-orm/postgresql";
import { OUTBOX_REPOSITORY, QUEUE } from "../applications.tokens";
import type { OutboxRepository } from "../application/ports/outbox-repository";
import type { Queue } from "../application/ports/queue";
import { runWithBypassRls } from "./bypass-rls";

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 20;

/**
 * ADR-002's outbox relay: the only thing that ever reads unprocessed `outbox` rows and forwards
 * them to BullMQ. A plain `@Interval` poller (matching the "reconciliation" style already used
 * for scheduled jobs, technical plan section 2.3) rather than a Postgres LISTEN/NOTIFY — simpler,
 * and a 2s poll is well within FR-APP-06's "add an app, see a result" latency budget.
 */
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);

  public constructor(
    private readonly em: EntityManager,
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
    @Inject(QUEUE) private readonly queue: Queue,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  public async relay(): Promise<void> {
    await runWithBypassRls(this.em, async () => {
      const entries = await this.outbox.findUnprocessed(BATCH_SIZE);
      for (const entry of entries) {
        await this.queue.enqueue(entry.kind, entry.payload);
        entry.markProcessed(new Date());
        await this.outbox.markProcessed(entry);
      }
      if (entries.length > 0) {
        this.logger.debug(`Relayed ${entries.length} outbox entr${entries.length === 1 ? "y" : "ies"}`);
      }
    });
  }
}
