import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { Organization } from "../domain/organization.entity";
import type { OrganizationRepository } from "../application/ports/organization-repository";

@Injectable()
export class MikroOrmOrganizationRepository implements OrganizationRepository {
  public constructor(
    @InjectRepository(Organization) private readonly repo: EntityRepository<Organization>,
  ) {}

  public findById(id: string): Promise<Organization | null> {
    return this.repo.findOne({ id });
  }

  public findBySlug(slug: string): Promise<Organization | null> {
    return this.repo.findOne({ slug });
  }

  public findAll(): Promise<Organization[]> {
    return this.repo.findAll();
  }

  public async save(organization: Organization): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(organization);
    await em.flush();
  }
}
