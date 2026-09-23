import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmInvitationRepository } from "./mikroorm-invitation.repository";
import { Invitation } from "../domain/invitation.entity";
import { Organization } from "../domain/organization.entity";
import { User } from "../domain/user.entity";
import { Role } from "../domain/role.enum";

interface FakeSetup {
  repository: MikroOrmInvitationRepository;
  underlying: EntityRepository<Invitation>;
  flush: jest.Mock;
  removeAndFlush: jest.Mock;
}

function build(): FakeSetup {
  const flush = jest.fn(async () => undefined);
  const removeAndFlush = jest.fn(async () => undefined);
  const em = { persist: jest.fn(), flush, removeAndFlush };
  const underlying = {
    findOne: jest.fn(),
    find: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<Invitation>;
  return { repository: new MikroOrmInvitationRepository(underlying), underlying, flush, removeAndFlush };
}

describe("MikroOrmInvitationRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const invitation = new Invitation(
    org,
    "invitee@acme.test",
    Role.VIEWER,
    "token-hash",
    new Date("2026-02-01T00:00:00.000Z"),
    admin,
  );

  it("finds by id with organization and invitedBy populated", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(invitation);

    const result = await repository.findById(invitation.id);

    expect(underlying.findOne).toHaveBeenCalledWith(
      { id: invitation.id },
      { populate: ["organization", "invitedBy"] },
    );
    expect(result).toBe(invitation);
  });

  it("finds by token hash", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(invitation);

    const result = await repository.findByTokenHash("token-hash");

    expect(underlying.findOne).toHaveBeenCalledWith(
      { tokenHash: "token-hash" },
      { populate: ["organization", "invitedBy"] },
    );
    expect(result).toBe(invitation);
  });

  it("finds by organization", async () => {
    const { repository, underlying } = build();
    (underlying.find as jest.Mock).mockResolvedValue([invitation]);

    const result = await repository.findByOrganization(org.id);

    expect(underlying.find).toHaveBeenCalledWith(
      { organization: org.id },
      { populate: ["invitedBy"] },
    );
    expect(result).toEqual([invitation]);
  });

  it("persists and flushes on save", async () => {
    const { repository, flush } = build();

    await repository.save(invitation);

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("removes and flushes on remove", async () => {
    const { repository, removeAndFlush } = build();

    await repository.remove(invitation);

    expect(removeAndFlush).toHaveBeenCalledWith(invitation);
  });
});
