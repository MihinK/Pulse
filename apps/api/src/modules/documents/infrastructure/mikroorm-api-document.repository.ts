import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { ApiDocument } from "../domain/api-document.entity";
import type { ApiDocumentRepository } from "../application/ports/api-document-repository";

@Injectable()
export class MikroOrmApiDocumentRepository implements ApiDocumentRepository {
  public constructor(
    @InjectRepository(ApiDocument) private readonly repo: EntityRepository<ApiDocument>,
  ) {}

  public findById(id: string): Promise<ApiDocument | null> {
    return this.repo.findOne({ id });
  }

  public findActiveByApplicationId(applicationId: string): Promise<ApiDocument | null> {
    return this.repo.findOne({ application: applicationId, isActive: true });
  }

  public findByApplicationId(applicationId: string): Promise<ApiDocument[]> {
    return this.repo.find({ application: applicationId }, { orderBy: { versionNo: "desc" } });
  }

  public async save(document: ApiDocument): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(document);
    await em.flush();
  }
}
