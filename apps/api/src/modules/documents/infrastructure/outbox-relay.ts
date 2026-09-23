import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { EntityManager } from "@mikro-orm/postgresql";
import { OUTBOX_REPOSITORY } from "../../applications/applications.tokens";
import type { OutboxRepository } from "../../applications/application/ports/outbox-repository";
import { runWithBypassRls } from "../../applications/infrastructure/bypass-rls";
import type { Queue } from "../application/ports/queue";
import { QUEUE } from "../documents.tokens";
import { DOCUMENT_UPLOADED_KIND } from "../domain/outbox-kinds";

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 20;

/**
 * This module's own poller on the shared `outbox` table (see `outbox-kinds.ts`'s header comment),
 * scoped to `document.uploaded` — mirrors `applications/infrastructure/outbox-relay.ts` exactly,
 * down to the poll interval, since both exist for the same ADR-002 reason.
 */
@Injectable()
export class DocumentOutboxRelay {
  private readonly logger = new Logger(DocumentOutboxRelay.name);

  public constructor(
    private readonly em: EntityManager,
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
    @Inject(QUEUE) private readonly queue: Queue,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  public async relay(): Promise<void> {
    await runWithBypassRls(this.em, async () => {
      const entries = await this.outbox.findUnprocessed(BATCH_SIZE, DOCUMENT_UPLOADED_KIND);
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
