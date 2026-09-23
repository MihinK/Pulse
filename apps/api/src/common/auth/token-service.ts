import type { Principal } from "./principal";

export const TOKEN_SERVICE = Symbol("TOKEN_SERVICE");

/**
 * Issues and verifies the short-lived JWT access token (technical plan section 8.1: 15 minutes).
 * Refresh tokens are a separate concern ({@link RefreshTokenService} in the identity module) —
 * they are opaque, stored hashed, and rotated, never JWTs.
 */
export interface TokenService {
  signAccessToken(principal: Principal): string;

  /** Throws `UnauthorizedException` if the token is missing, malformed, or expired. */
  verifyAccessToken(token: string): Principal;
}
