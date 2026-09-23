import { UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthController } from "./auth.controller";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "./refresh-cookie";
import type { AuthService, Session } from "../application/auth.service";
import { Role } from "../domain/role.enum";

function buildResponse(): Response {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
}

const session: Session = {
  accessToken: "access-token",
  refreshToken: "raw-refresh-token",
  principal: { userId: "u1", organizationId: "org-1", role: Role.ADMIN },
};

describe("AuthController", () => {
  it("login sets the refresh cookie and returns the session", async () => {
    const authService = {
      login: jest.fn().mockResolvedValue(session),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = buildResponse();

    const result = await controller.login({ email: "a@acme.test", password: "secret" }, res);

    expect(authService.login).toHaveBeenCalledWith("a@acme.test", "secret");
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      "raw-refresh-token",
      expect.objectContaining({ path: REFRESH_COOKIE_PATH }),
    );
    expect(result.accessToken).toBe("access-token");
  });

  it("refresh reads the cookie, rotates it, and returns the new session", async () => {
    const authService = {
      refresh: jest.fn().mockResolvedValue(session),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const req = { cookies: { [REFRESH_COOKIE_NAME]: "old-token" } } as unknown as Request;
    const res = buildResponse();

    await controller.refresh(req, res);

    expect(authService.refresh).toHaveBeenCalledWith("old-token");
    expect(res.cookie).toHaveBeenCalled();
  });

  it("refresh rejects when there is no cookie", async () => {
    const authService = { refresh: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);
    const req = { cookies: {} } as unknown as Request;

    await expect(controller.refresh(req, buildResponse())).rejects.toThrow(UnauthorizedException);
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it("logout revokes the token (when present) and clears the cookie", async () => {
    const authService = { logout: jest.fn().mockResolvedValue(undefined) } as unknown as AuthService;
    const controller = new AuthController(authService);
    const req = { cookies: { [REFRESH_COOKIE_NAME]: "old-token" } } as unknown as Request;
    const res = buildResponse();

    await controller.logout(req, res);

    expect(authService.logout).toHaveBeenCalledWith("old-token");
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  });

  it("logout clears the cookie even with no refresh token present", async () => {
    const authService = { logout: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);
    const req = { cookies: {} } as unknown as Request;
    const res = buildResponse();

    await controller.logout(req, res);

    expect(authService.logout).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalled();
  });
});
