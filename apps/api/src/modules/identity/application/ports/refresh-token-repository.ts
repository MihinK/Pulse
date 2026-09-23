import type { RefreshToken } from "../../domain/refresh-token.entity";

export interface RefreshTokenRepository {
  /** Bypass-scoped: used only by `AuthService.refresh`/`logout`, before an org is known. */
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  save(token: RefreshToken): Promise<void>;
}
