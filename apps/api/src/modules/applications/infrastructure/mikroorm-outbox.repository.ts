import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { OutboxEntry } from "../domain/outbox-entry.entity";
import type { OutboxRepository } from "../application/ports/outbox-repository";

@Injectable()
export class MikroOrmOutboxRepository implements OutboxRepository {
  public constructor(
    @InjectRepository(OutboxEntry) private readonly repo: EntityRepository<OutboxEntry>,
  ) {}

  public findUnprocessed(limit: number): Promise<OutboxEntry[]> {
    return this.repo.find({ processedAt: null }, { orderBy: { createdAt: "asc" }, limit });
  }

  public async save(entry: OutboxEntry): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(entry);
    await em.flush();
  }

  public async markProcessed(entry: OutboxEntry): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(entry);
    await em.flush();
  }
}
