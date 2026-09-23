import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { AuditLog } from "./audit-log.entity";

describe("AuditLog", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);

  it("records an action with before/after snapshots", () => {
    const log = new AuditLog(org, admin, "application.created", "Application", "app-1", {
      after: { name: "API" },
    });

    expect(log.action).toBe("application.created");
    expect(log.entityType).toBe("Application");
    expect(log.entityId).toBe("app-1");
    expect(log.before).toBeUndefined();
    expect(log.after).toEqual({ name: "API" });
  });
});
