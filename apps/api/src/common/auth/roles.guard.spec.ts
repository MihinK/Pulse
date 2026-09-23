import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import type { Principal } from "./principal";
import { Role } from "../../modules/identity/domain/role.enum";

function contextWith(principal: Principal | undefined): ExecutionContext {
  const request = { principal };
  return {
    getHandler: () => (): void => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  function build(requiredRoles: Role[] | undefined): RolesGuard {
    const reflector = { getAllAndOverride: () => requiredRoles } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it("allows any authenticated principal when no roles are required", () => {
    const guard = build(undefined);
    const context = contextWith({ userId: "u1", organizationId: "o1", role: Role.VIEWER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows a principal whose role is in the required list", () => {
    const guard = build([Role.ADMIN, Role.PLATFORM_OWNER]);
    const context = contextWith({ userId: "u1", organizationId: "o1", role: Role.ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a principal whose role is not in the required list", () => {
    const guard = build([Role.ADMIN]);
    const context = contextWith({ userId: "u1", organizationId: "o1", role: Role.VIEWER });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejects when there is no principal at all", () => {
    const guard = build([Role.ADMIN]);
    const context = contextWith(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
