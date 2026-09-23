import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { AuditLog } from "../domain/audit-log.entity";
import type { AuditLogRepository } from "../application/ports/audit-log-repository";

@Injectable()
export class MikroOrmAuditLogRepository implements AuditLogRepository {
  public constructor(
    @InjectRepository(AuditLog) private readonly repo: EntityRepository<AuditLog>,
  ) {}

  public async save(entry: AuditLog): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(entry);
    await em.flush();
  }
}
