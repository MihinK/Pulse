import type { Request, Response } from "express";

export const REFRESH_COOKIE_NAME = "pulse_rt";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

/** Shared by `AuthController` (login/refresh/logout) and `InvitationAcceptController` (accept auto-logs-in). */
export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: REFRESH_COOKIE_PATH,
  });
}

export function extractRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}
