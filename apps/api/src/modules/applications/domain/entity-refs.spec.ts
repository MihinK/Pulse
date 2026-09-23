import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { organizationRef, touchUpdatedAt, userRef } from "./entity-refs";

describe("entity-refs", () => {
  it("organizationRef returns the Organization class", () => {
    expect(organizationRef()).toBe(Organization);
  });

  it("userRef returns the User class", () => {
    expect(userRef()).toBe(User);
  });

  it("touchUpdatedAt returns the current time", () => {
    expect(touchUpdatedAt()).toBeInstanceOf(Date);
  });
});
