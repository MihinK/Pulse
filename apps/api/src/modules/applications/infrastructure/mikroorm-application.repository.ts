import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository, FilterQuery } from "@mikro-orm/postgresql";
import { Application } from "../domain/application.entity";
import type { ApplicationFilter, ApplicationRepository } from "../application/ports/application-repository";

@Injectable()
export class MikroOrmApplicationRepository implements ApplicationRepository {
  public constructor(
    @InjectRepository(Application) private readonly repo: EntityRepository<Application>,
  ) {}

  public findById(id: string): Promise<Application | null> {
    return this.repo.findOne({ id });
  }

  public findAll(filter: ApplicationFilter = {}): Promise<Application[]> {
    const where: FilterQuery<Application> = { deletedAt: null };
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.environment) {
      where.environment = filter.environment;
    }
    if (filter.search) {
      where.name = { $ilike: `%${filter.search}%` };
    }
    return this.repo.find(where, { orderBy: { createdAt: "desc" } });
  }

  public async save(application: Application): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(application);
    await em.flush();
  }
}
