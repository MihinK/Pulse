import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ProfileService } from "./profile.service";
import { User } from "../domain/user.entity";
import { Organization } from "../domain/organization.entity";
import { Role } from "../domain/role.enum";
import type { UserRepository } from "./ports/user-repository";

class FakeUserRepository implements UserRepository {
  public readonly byId = new Map<string, User>();
  public constructor(users: User[]) {
    users.forEach((u) => this.byId.set(u.id, u));
  }
  public findById(id: string): Promise<User | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }
  public findAllByEmailAcrossOrgs(): Promise<User[]> {
    return Promise.resolve([]);
  }
  public findByOrganization(organizationId: string): Promise<User[]> {
    return Promise.resolve([...this.byId.values()].filter((u) => u.organizationId() === organizationId));
  }
  public countPlatformOwners(): Promise<number> {
    return Promise.resolve(0);
  }
  public save(user: User): Promise<void> {
    this.byId.set(user.id, user);
    return Promise.resolve();
  }
}

describe("ProfileService", () => {
  const org = new Organization("Acme", "acme", "UTC");

  it("fetches the caller's own profile", async () => {
    const user = new User("a@acme.test", "hash", Role.VIEWER, org);
    const service = new ProfileService(new FakeUserRepository([user]));

    const fetched = await service.getSelf(user.id);

    expect(fetched).toBe(user);
  });

  it("throws when the user does not exist", async () => {
    const service = new ProfileService(new FakeUserRepository([]));

    await expect(service.getSelf("missing")).rejects.toThrow(NotFoundException);
  });

  it("updates the time zone when it is a valid IANA name", async () => {
    const user = new User("a@acme.test", "hash", Role.VIEWER, org);
    const service = new ProfileService(new FakeUserRepository([user]));

    const updated = await service.updateTimeZone(user.id, "America/New_York");

    expect(updated.timeZone).toBe("America/New_York");
  });

  it("rejects an invalid time zone", async () => {
    const user = new User("a@acme.test", "hash", Role.VIEWER, org);
    const service = new ProfileService(new FakeUserRepository([user]));

    await expect(service.updateTimeZone(user.id, "Not/A/Zone")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("lists users belonging to an organization", async () => {
    const other = new Organization("Beta", "beta", "UTC");
    const inOrg = new User("a@acme.test", "hash", Role.VIEWER, org);
    const inOtherOrg = new User("b@beta.test", "hash", Role.VIEWER, other);
    const service = new ProfileService(new FakeUserRepository([inOrg, inOtherOrg]));

    const users = await service.listByOrganization(org.id);

    expect(users).toEqual([inOrg]);
  });
});
