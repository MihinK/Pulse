import { ConflictException } from "@nestjs/common";
import { UniqueConstraintViolationException, type EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmUserRepository } from "./mikroorm-user.repository";
import { User } from "../domain/user.entity";
import { Organization } from "../domain/organization.entity";
import { Role } from "../domain/role.enum";

interface FakeSetup {
  repository: MikroOrmUserRepository;
  underlying: EntityRepository<User>;
  flush: jest.Mock;
}

function build(flushImpl: () => Promise<void> = async () => undefined): FakeSetup {
  const flush = jest.fn(flushImpl);
  const em = { persist: jest.fn(), flush };
  const underlying = {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<User>;
  return { repository: new MikroOrmUserRepository(underlying), underlying, flush };
}

describe("MikroOrmUserRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const user = new User("a@acme.test", "hash", Role.ADMIN, org);

  it("finds by id with the organization populated", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(user);

    const result = await repository.findById(user.id);

    expect(underlying.findOne).toHaveBeenCalledWith({ id: user.id }, { populate: ["organization"] });
    expect(result).toBe(user);
  });

  it("finds all matching emails across organizations", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([user]);

    const result = await repository.findAllByEmailAcrossOrgs("a@acme.test");

    expect(underlying.find).toHaveBeenCalledWith(
      { email: "a@acme.test" },
      { populate: ["organization"] },
    );
    expect(result).toEqual([user]);
  });

  it("finds users by organization", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([user]);

    const result = await repository.findByOrganization(org.id);

    expect(underlying.find).toHaveBeenCalledWith({ organization: org.id });
    expect(result).toEqual([user]);
  });

  it("counts platform owners", async () => {
    const { repository, underlying } = build();
    (underlying.count as jest.Mock).mockResolvedValue(1);

    const result = await repository.countPlatformOwners();

    expect(underlying.count).toHaveBeenCalledWith({ role: Role.PLATFORM_OWNER });
    expect(result).toBe(1);
  });

  it("persists and flushes on save", async () => {
    const { repository, flush } = build();

    await repository.save(user);

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("translates a unique-constraint violation into ConflictException", async () => {
    const { repository } = build(() => {
      throw new UniqueConstraintViolationException(new Error("duplicate key"));
    });

    await expect(repository.save(user)).rejects.toThrow(ConflictException);
  });

  it("rethrows any other error unchanged", async () => {
    const { repository } = build(() => {
      throw new Error("connection lost");
    });

    await expect(repository.save(user)).rejects.toThrow("connection lost");
  });
});
