import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { TokenService } from "./token-service";
import type { Principal } from "./principal";
import { Role } from "../../modules/identity/domain/role.enum";

function contextWith(headers: Record<string, string>): {
  context: ExecutionContext;
  request: { headers: Record<string, string>; principal?: Principal };
} {
  const request: { headers: Record<string, string>; principal?: Principal } = { headers };
  const context = {
    getHandler: () => (): void => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("JwtAuthGuard", () => {
  const principal: Principal = { userId: "u1", organizationId: "o1", role: Role.ADMIN };

  function build(isPublic: boolean): { guard: JwtAuthGuard; tokenService: TokenService } {
    const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
    const tokenService: TokenService = {
      signAccessToken: jest.fn(),
      verifyAccessToken: jest.fn().mockReturnValue(principal),
    };
    return { guard: new JwtAuthGuard(reflector, tokenService), tokenService };
  }

  it("allows a public route with no token", () => {
    const { guard } = build(true);
    const { context, request } = contextWith({});

    expect(guard.canActivate(context)).toBe(true);
    expect(request.principal).toBeUndefined();
  });

  it("rejects a non-public route with no token", () => {
    const { guard } = build(false);
    const { context } = contextWith({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("attaches the principal when a bearer token is present", () => {
    const { guard, tokenService } = build(false);
    const { context, request } = contextWith({ authorization: "Bearer abc.def.ghi" });

    expect(guard.canActivate(context)).toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith("abc.def.ghi");
    expect(request.principal).toBe(principal);
  });

  it("ignores a malformed authorization header", () => {
    const { guard } = build(false);
    const { context } = contextWith({ authorization: "Basic abc" });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
