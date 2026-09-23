import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { CheckResult } from "../domain/check-result.entity";
import type { CheckResultRepository } from "../application/ports/check-result-repository";

@Injectable()
export class MikroOrmCheckResultRepository implements CheckResultRepository {
  public constructor(
    @InjectRepository(CheckResult) private readonly repo: EntityRepository<CheckResult>,
  ) {}

  public findByCheckRunId(checkRunId: string): Promise<CheckResult[]> {
    return this.repo.find({ checkRun: checkRunId }, { orderBy: { checkedAt: "asc" } });
  }

  public async saveAll(results: CheckResult[]): Promise<void> {
    const em = this.repo.getEntityManager();
    for (const result of results) {
      em.persist(result);
    }
    await em.flush();
  }
}
