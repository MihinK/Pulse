import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmRefreshTokenRepository } from "./mikroorm-refresh-token.repository";
import { RefreshToken } from "../domain/refresh-token.entity";
import { Organization } from "../domain/organization.entity";
import { User } from "../domain/user.entity";
import { Role } from "../domain/role.enum";

interface FakeSetup {
  repository: MikroOrmRefreshTokenRepository;
  underlying: EntityRepository<RefreshToken>;
  flush: jest.Mock;
}

function build(): FakeSetup {
  const flush = jest.fn(async () => undefined);
  const em = { persist: jest.fn(), flush };
  const underlying = {
    findOne: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<RefreshToken>;
  return { repository: new MikroOrmRefreshTokenRepository(underlying), underlying, flush };
}

describe("MikroOrmRefreshTokenRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const user = new User("a@acme.test", "hash", Role.ADMIN, org);
  const token = new RefreshToken(user, "token-hash", new Date("2026-02-01T00:00:00.000Z"));

  it("finds by token hash with user, organization and replacement populated", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(token);

    const result = await repository.findByTokenHash("token-hash");

    expect(underlying.findOne).toHaveBeenCalledWith(
      { tokenHash: "token-hash" },
      { populate: ["user", "user.organization", "replacedBy"] },
    );
    expect(result).toBe(token);
  });

  it("persists and flushes on save", async () => {
    const { repository, flush } = build();

    await repository.save(token);

    expect(flush).toHaveBeenCalledTimes(1);
  });
});
