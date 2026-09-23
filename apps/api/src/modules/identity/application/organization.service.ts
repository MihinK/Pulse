import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Organization } from "../domain/organization.entity";
import { Edition } from "../domain/edition.enum";
import { ORGANIZATION_REPOSITORY } from "../identity.tokens";
import type { OrganizationRepository } from "./ports/organization-repository";

/** Platform Owner CRUD (technical plan section 2.1: "Who creates orgs" — Cloud edition only). */
@Injectable()
export class OrganizationService {
  public constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
  ) {}

  public async create(name: string, slug: string, defaultTimeZone: string): Promise<Organization> {
    const existing = await this.organizations.findBySlug(slug);
    if (existing) {
      throw new ConflictException(`An organisation with slug "${slug}" already exists`);
    }
    const organization = new Organization(name, slug, defaultTimeZone, Edition.CLOUD);
    await this.organizations.save(organization);
    return organization;
  }

  public async list(): Promise<Organization[]> {
    return this.organizations.findAll();
  }

  public async getById(id: string): Promise<Organization> {
    const organization = await this.organizations.findById(id);
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    return organization;
  }

  public async setActive(id: string, active: boolean): Promise<Organization> {
    const organization = await this.getById(id);
    if (active) {
      organization.activate();
    } else {
      organization.suspend();
    }
    await this.organizations.save(organization);
    return organization;
  }
}
