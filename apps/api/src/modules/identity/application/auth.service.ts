import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import type { Clock } from "@pulse/shared";
import { User } from "../domain/user.entity";
import { RefreshToken } from "../domain/refresh-token.entity";
import type { Principal } from "../../../common/auth/principal";
import { TOKEN_SERVICE, type TokenService } from "../../../common/auth/token-service";
import { CLOCK, USER_REPOSITORY, REFRESH_TOKEN_REPOSITORY, PASSWORD_HASHER, REFRESH_TOKEN_TTL_MS } from "../identity.tokens";
import type { UserRepository } from "./ports/user-repository";
import type { RefreshTokenRepository } from "./ports/refresh-token-repository";
import type { PasswordHasher } from "./ports/password-hasher";

export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly principal: Principal;
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function toPrincipal(user: User): Principal {
  return { userId: user.id, organizationId: user.organizationId() ?? null, role: user.role };
}

/**
 * Login, refresh and logout. Login looks across every organisation for a matching email (see
 * `UserRepository.findAllByEmailAcrossOrgs`) because `users` is unique on `(organization,
 * email)`, not on email alone — the same email can hold separate accounts in separate orgs.
 * Refresh tokens rotate on every use (technical plan section 8.1): the old row is revoked and
 * chained to the new one via `replacedBy`, so a stolen-and-reused token is detectable.
 */
@Injectable()
export class AuthService {
  public constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(REFRESH_TOKEN_TTL_MS) private readonly refreshTokenTtlMs: number,
  ) {}

  public async login(email: string, password: string): Promise<Session> {
    const candidates = await this.users.findAllByEmailAcrossOrgs(email);
    for (const user of candidates) {
      // candidates is 0 or 1 rows in practice, so a loop here is not a real serial-await concern
      if (await this.passwordHasher.verify(user.passwordHash, password)) {
        return this.issueSession(user);
      }
    }
    throw new UnauthorizedException("Invalid email or password");
  }

  public async issueSession(user: User): Promise<Session> {
    const accessToken = this.tokenService.signAccessToken(toPrincipal(user));
    const rawRefreshToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(this.clock.now().getTime() + this.refreshTokenTtlMs);
    const refreshToken = new RefreshToken(user, hashToken(rawRefreshToken), expiresAt);
    await this.refreshTokens.save(refreshToken);
    return { accessToken, refreshToken: rawRefreshToken, principal: toPrincipal(user) };
  }

  public async refresh(rawRefreshToken: string): Promise<Session> {
    const existing = await this.refreshTokens.findByTokenHash(hashToken(rawRefreshToken));
    if (!existing || !existing.isValid(this.clock)) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = existing.user;
    const accessToken = this.tokenService.signAccessToken(toPrincipal(user));
    const rawNewRefreshToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(this.clock.now().getTime() + this.refreshTokenTtlMs);
    const newRefreshToken = new RefreshToken(user, hashToken(rawNewRefreshToken), expiresAt);

    existing.revoke(this.clock, newRefreshToken);
    await this.refreshTokens.save(newRefreshToken);
    await this.refreshTokens.save(existing);

    return { accessToken, refreshToken: rawNewRefreshToken, principal: toPrincipal(user) };
  }

  public async logout(rawRefreshToken: string): Promise<void> {
    const existing = await this.refreshTokens.findByTokenHash(hashToken(rawRefreshToken));
    if (existing && !existing.isRevoked()) {
      existing.revoke(this.clock);
      await this.refreshTokens.save(existing);
    }
  }
}
