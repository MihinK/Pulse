import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { Endpoint } from "../domain/endpoint.entity";
import type { EndpointRepository } from "../application/ports/endpoint-repository";

@Injectable()
export class MikroOrmEndpointRepository implements EndpointRepository {
  public constructor(
    @InjectRepository(Endpoint) private readonly repo: EntityRepository<Endpoint>,
  ) {}

  public findById(id: string): Promise<Endpoint | null> {
    return this.repo.findOne({ id });
  }

  public findByApiDocumentId(apiDocumentId: string): Promise<Endpoint[]> {
    return this.repo.find({ apiDocument: apiDocumentId }, { orderBy: { path: "asc", method: "asc" } });
  }

  public async saveAll(endpoints: Endpoint[]): Promise<void> {
    const em = this.repo.getEntityManager();
    for (const endpoint of endpoints) {
      em.persist(endpoint);
    }
    await em.flush();
  }

  public async save(endpoint: Endpoint): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(endpoint);
    await em.flush();
  }
}
