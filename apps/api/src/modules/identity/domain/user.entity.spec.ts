import { User } from "./user.entity";
import { Role } from "./role.enum";
import { Organization } from "./organization.entity";

describe("User", () => {
  const org = new Organization("Acme", "acme", "UTC");

  it("defaults to UTC time zone", () => {
    const user = new User("a@acme.test", "hash", Role.VIEWER, org);

    expect(user.timeZone).toBe("UTC");
    expect(user.organizationId()).toBe(org.id);
    expect(user.isPlatformOwner()).toBe(false);
  });

  it("has no organization when it is the Platform Owner", () => {
    const owner = new User("owner@pulse.test", "hash", Role.PLATFORM_OWNER);

    expect(owner.organization).toBeUndefined();
    expect(owner.organizationId()).toBeUndefined();
    expect(owner.isPlatformOwner()).toBe(true);
  });

  it("updates its password hash", () => {
    const user = new User("a@acme.test", "hash", Role.VIEWER, org);

    user.updatePasswordHash("new-hash");

    expect(user.passwordHash).toBe("new-hash");
  });

  it("updates its time zone", () => {
    const user = new User("a@acme.test", "hash", Role.VIEWER, org);

    user.updateTimeZone("America/New_York");

    expect(user.timeZone).toBe("America/New_York");
  });
});
