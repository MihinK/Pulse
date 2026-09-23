import { ConflictException, NotFoundException } from "@nestjs/common";
import { OrganizationService } from "./organization.service";
import { Organization } from "../domain/organization.entity";
import { Edition } from "../domain/edition.enum";
import type { OrganizationRepository } from "./ports/organization-repository";

class FakeOrganizationRepository implements OrganizationRepository {
  public readonly byId = new Map<string, Organization>();
  public readonly bySlug = new Map<string, Organization>();

  public findById(id: string): Promise<Organization | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }
  public findBySlug(slug: string): Promise<Organization | null> {
    return Promise.resolve(this.bySlug.get(slug) ?? null);
  }
  public findAll(): Promise<Organization[]> {
    return Promise.resolve([...this.byId.values()]);
  }
  public save(organization: Organization): Promise<void> {
    this.byId.set(organization.id, organization);
    this.bySlug.set(organization.slug, organization);
    return Promise.resolve();
  }
}

describe("OrganizationService", () => {
  it("creates a Cloud-edition organization", async () => {
    const repo = new FakeOrganizationRepository();
    const service = new OrganizationService(repo);

    const org = await service.create("Acme", "acme", "UTC");

    expect(org.edition).toBe(Edition.CLOUD);
    expect(repo.bySlug.get("acme")).toBe(org);
  });

  it("refuses to create a second organization with the same slug", async () => {
    const repo = new FakeOrganizationRepository();
    const service = new OrganizationService(repo);
    await service.create("Acme", "acme", "UTC");

    await expect(service.create("Acme 2", "acme", "UTC")).rejects.toThrow(ConflictException);
  });

  it("lists all organizations", async () => {
    const repo = new FakeOrganizationRepository();
    const service = new OrganizationService(repo);
    await service.create("Acme", "acme", "UTC");
    await service.create("Beta", "beta", "UTC");

    const orgs = await service.list();

    expect(orgs).toHaveLength(2);
  });

  it("getById throws when the organization does not exist", async () => {
    const service = new OrganizationService(new FakeOrganizationRepository());

    await expect(service.getById("missing")).rejects.toThrow(NotFoundException);
  });

  it("suspends and reactivates", async () => {
    const repo = new FakeOrganizationRepository();
    const service = new OrganizationService(repo);
    const org = await service.create("Acme", "acme", "UTC");

    const suspended = await service.setActive(org.id, false);
    expect(suspended.isActive()).toBe(false);

    const reactivated = await service.setActive(org.id, true);
    expect(reactivated.isActive()).toBe(true);
  });
});
