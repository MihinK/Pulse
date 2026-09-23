import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { CheckRun } from "../domain/check-run.entity";
import type { CheckRunRepository } from "../application/ports/check-run-repository";

@Injectable()
export class MikroOrmCheckRunRepository implements CheckRunRepository {
  public constructor(
    @InjectRepository(CheckRun) private readonly repo: EntityRepository<CheckRun>,
  ) {}

  public findById(id: string): Promise<CheckRun | null> {
    return this.repo.findOne({ id });
  }

  public findByApplicationId(applicationId: string, limit = 20): Promise<CheckRun[]> {
    return this.repo.find(
      { application: applicationId },
      { orderBy: { createdAt: "desc" }, limit },
    );
  }

  public async save(checkRun: CheckRun): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(checkRun);
    await em.flush();
  }
}
