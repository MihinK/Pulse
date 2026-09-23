import "reflect-metadata";
import { Roles, ROLES_KEY } from "./roles.decorator";
import { Role } from "../../modules/identity/domain/role.enum";

describe("@Roles", () => {
  it("attaches the required roles as handler metadata", () => {
    class Controller {
      @Roles(Role.ADMIN, Role.PLATFORM_OWNER)
      public handler(): void {}
    }

    expect(Reflect.getMetadata(ROLES_KEY, Controller.prototype.handler)).toEqual([
      Role.ADMIN,
      Role.PLATFORM_OWNER,
    ]);
  });
});
