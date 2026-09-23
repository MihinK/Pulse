import type { ExecutionContext } from "@nestjs/common";
import { extractCurrentUser } from "./current-user.decorator";
import type { Principal } from "./principal";
import { Role } from "../../modules/identity/domain/role.enum";

describe("extractCurrentUser", () => {
  it("returns the request's principal", () => {
    const principal: Principal = { userId: "u1", organizationId: "o1", role: Role.VIEWER };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ principal }) }),
    } as unknown as ExecutionContext;

    expect(extractCurrentUser(undefined, context)).toBe(principal);
  });

  it("throws when there is no principal on the request", () => {
    const context = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    expect(() => extractCurrentUser(undefined, context)).toThrow();
  });
});
