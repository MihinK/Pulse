import type { Request, Response } from "express";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, extractRefreshCookie, setRefreshCookie } from "./refresh-cookie";

describe("refresh-cookie", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("sets an httpOnly, path-scoped cookie", () => {
    process.env.NODE_ENV = "test";
    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;

    setRefreshCookie(res, "raw-token");

    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      "raw-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: REFRESH_COOKIE_PATH,
      }),
    );
  });

  it("marks the cookie secure in production", () => {
    process.env.NODE_ENV = "production";
    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;

    setRefreshCookie(res, "raw-token");

    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      "raw-token",
      expect.objectContaining({ secure: true }),
    );
  });

  it("extracts the refresh token from the request's cookies", () => {
    const req = { cookies: { [REFRESH_COOKIE_NAME]: "raw-token" } } as unknown as Request;

    expect(extractRefreshCookie(req)).toBe("raw-token");
  });

  it("returns undefined when there is no cookie", () => {
    const req = { cookies: {} } as unknown as Request;

    expect(extractRefreshCookie(req)).toBeUndefined();
  });

  it("returns undefined when cookies is undefined", () => {
    const req = {} as unknown as Request;

    expect(extractRefreshCookie(req)).toBeUndefined();
  });
});
