import { UserResponseDto } from "./user-response.dto";
import { User } from "../../domain/user.entity";
import { Organization } from "../../domain/organization.entity";
import { Role } from "../../domain/role.enum";

describe("UserResponseDto.fromDomain", () => {
  it("maps a regular user, including its organization id", () => {
    const org = new Organization("Acme", "acme", "UTC");
    const user = new User("a@acme.test", "hash", Role.VIEWER, org);

    const dto = UserResponseDto.fromDomain(user);

    expect(dto).toEqual({
      id: user.id,
      email: "a@acme.test",
      role: Role.VIEWER,
      organizationId: org.id,
      timeZone: "UTC",
    });
  });

  it("maps the Platform Owner with a null organization id", () => {
    const owner = new User("owner@pulse.test", "hash", Role.PLATFORM_OWNER);

    const dto = UserResponseDto.fromDomain(owner);

    expect(dto.organizationId).toBeNull();
  });
});
