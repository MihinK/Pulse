import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { AuthConfig } from "../domain/auth-config.entity";
import type { AuthConfigRepository } from "../application/ports/auth-config-repository";

@Injectable()
export class MikroOrmAuthConfigRepository implements AuthConfigRepository {
  public constructor(
    @InjectRepository(AuthConfig) private readonly repo: EntityRepository<AuthConfig>,
  ) {}

  public findByApplicationId(applicationId: string): Promise<AuthConfig | null> {
    return this.repo.findOne({ application: applicationId });
  }

  public async save(authConfig: AuthConfig): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(authConfig);
    await em.flush();
  }
}
