import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmOrganizationRepository } from "./mikroorm-organization.repository";
import { Organization } from "../domain/organization.entity";

interface FakeSetup {
  repository: MikroOrmOrganizationRepository;
  underlying: EntityRepository<Organization>;
  persisted: Organization[];
  flushCount: { value: number };
}

function build(): FakeSetup {
  const persisted: Organization[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (org: Organization): void => {
      persisted.push(org);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<Organization>;
  return { repository: new MikroOrmOrganizationRepository(underlying), underlying, persisted, flushCount };
}

describe("MikroOrmOrganizationRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");

  it("finds by id", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(org);

    const result = await repository.findById(org.id);

    expect(underlying.findOne).toHaveBeenCalledWith({ id: org.id });
    expect(result).toBe(org);
  });

  it("finds by slug", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(org);

    const result = await repository.findBySlug("acme");

    expect(underlying.findOne).toHaveBeenCalledWith({ slug: "acme" });
    expect(result).toBe(org);
  });

  it("finds all", async () => {
    const { repository, underlying } = build();
    (underlying.findAll as jest.Mock).mockResolvedValue([org]);

    const result = await repository.findAll();

    expect(result).toEqual([org]);
  });

  it("persists and flushes on save", async () => {
    const { repository, persisted, flushCount } = build();

    await repository.save(org);

    expect(persisted).toEqual([org]);
    expect(flushCount.value).toBe(1);
  });
});
