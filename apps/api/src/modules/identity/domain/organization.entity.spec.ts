import { Organization } from "./organization.entity";
import { OrganizationStatus } from "./organization-status.enum";
import { Edition } from "./edition.enum";

describe("Organization", () => {
  it("starts active in the Cloud edition by default", () => {
    const org = new Organization("Acme", "acme", "UTC");

    expect(org.status).toBe(OrganizationStatus.ACTIVE);
    expect(org.edition).toBe(Edition.CLOUD);
    expect(org.isActive()).toBe(true);
    expect(org.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("can be created in the Private edition", () => {
    const org = new Organization("Acme", "acme", "UTC", Edition.PRIVATE);

    expect(org.edition).toBe(Edition.PRIVATE);
  });

  it("suspends and reactivates", () => {
    const org = new Organization("Acme", "acme", "UTC");

    org.suspend();
    expect(org.status).toBe(OrganizationStatus.SUSPENDED);
    expect(org.isActive()).toBe(false);

    org.activate();
    expect(org.status).toBe(OrganizationStatus.ACTIVE);
    expect(org.isActive()).toBe(true);
  });

  it("renames", () => {
    const org = new Organization("Acme", "acme", "UTC");

    org.rename("Acme Corp");

    expect(org.name).toBe("Acme Corp");
  });
});
