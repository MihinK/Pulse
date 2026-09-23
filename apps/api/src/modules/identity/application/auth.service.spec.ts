import { UnauthorizedException } from "@nestjs/common";
import { FixedClock } from "@pulse/shared";
import { AuthService, hashToken } from "./auth.service";
import { User } from "../domain/user.entity";
import { Organization } from "../domain/organization.entity";
import { RefreshToken } from "../domain/refresh-token.entity";
import { Role } from "../domain/role.enum";
import type { UserRepository } from "./ports/user-repository";
import type { RefreshTokenRepository } from "./ports/refresh-token-repository";
import type { PasswordHasher } from "./ports/password-hasher";
import type { TokenService } from "../../../common/auth/token-service";
import type { Principal } from "../../../common/auth/principal";

class FakeUserRepository implements UserRepository {
  public readonly saved: User[] = [];
  public constructor(private readonly usersByEmail: User[]) {}
  public findById(): Promise<User | null> {
    return Promise.resolve(null);
  }
  public findAllByEmailAcrossOrgs(email: string): Promise<User[]> {
    return Promise.resolve(this.usersByEmail.filter((u) => u.email === email));
  }
  public findByOrganization(): Promise<User[]> {
    return Promise.resolve([]);
  }
  public countPlatformOwners(): Promise<number> {
    return Promise.resolve(0);
  }
  public save(user: User): Promise<void> {
    this.saved.push(user);
    return Promise.resolve();
  }
}

class FakeRefreshTokenRepository implements RefreshTokenRepository {
  public readonly saved: RefreshToken[] = [];
  public constructor(private tokensByHash: Map<string, RefreshToken> = new Map()) {}
  public findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return Promise.resolve(this.tokensByHash.get(tokenHash) ?? null);
  }
  public save(token: RefreshToken): Promise<void> {
    this.saved.push(token);
    this.tokensByHash.set(token.tokenHash, token);
    return Promise.resolve();
  }
}

class FakePasswordHasher implements PasswordHasher {
  public hash(plainText: string): Promise<string> {
    return Promise.resolve(`hashed:${plainText}`);
  }
  public verify(passwordHash: string, plainText: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${plainText}`);
  }
}

class FakeTokenService implements TokenService {
  public readonly issuedFor: Principal[] = [];
  public signAccessToken(principal: Principal): string {
    this.issuedFor.push(principal);
    return `access-token-for-${principal.userId}`;
  }
  public verifyAccessToken(): Principal {
    throw new Error("not used in these tests");
  }
}

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

describe("AuthService", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const now = new Date("2026-01-01T00:00:00.000Z");

  function build(users: User[]): {
    service: AuthService;
    userRepo: FakeUserRepository;
    refreshRepo: FakeRefreshTokenRepository;
    tokenService: FakeTokenService;
    clock: FixedClock;
  } {
    const userRepo = new FakeUserRepository(users);
    const refreshRepo = new FakeRefreshTokenRepository();
    const tokenService = new FakeTokenService();
    const clock = new FixedClock(now);
    const service = new AuthService(
      userRepo,
      refreshRepo,
      new FakePasswordHasher(),
      tokenService,
      clock,
      REFRESH_TTL_MS,
    );
    return { service, userRepo, refreshRepo, tokenService, clock };
  }

  it("logs in with the correct password and issues a session", async () => {
    const user = new User("a@acme.test", "hashed:secret", Role.ADMIN, org);
    const { service, refreshRepo, tokenService } = build([user]);

    const session = await service.login("a@acme.test", "secret");

    expect(session.accessToken).toBe(`access-token-for-${user.id}`);
    expect(session.principal).toEqual({ userId: user.id, organizationId: org.id, role: "ADMIN" });
    expect(refreshRepo.saved).toHaveLength(1);
    expect(refreshRepo.saved[0]?.tokenHash).toBe(hashToken(session.refreshToken));
    expect(tokenService.issuedFor).toHaveLength(1);
  });

  it("rejects an unknown email", async () => {
    const { service } = build([]);

    await expect(service.login("nobody@acme.test", "secret")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rejects the wrong password", async () => {
    const user = new User("a@acme.test", "hashed:secret", Role.ADMIN, org);
    const { service } = build([user]);

    await expect(service.login("a@acme.test", "wrong")).rejects.toThrow(UnauthorizedException);
  });

  it("logs in to the matching account when the same email exists in two orgs", async () => {
    const orgB = new Organization("Beta", "beta", "UTC");
    const userA = new User("shared@test.test", "hashed:pw-a", Role.ADMIN, org);
    const userB = new User("shared@test.test", "hashed:pw-b", Role.VIEWER, orgB);
    const { service } = build([userA, userB]);

    const session = await service.login("shared@test.test", "pw-b");

    expect(session.principal.userId).toBe(userB.id);
    expect(session.principal.organizationId).toBe(orgB.id);
  });

  it("rotates a valid refresh token", async () => {
    const user = new User("a@acme.test", "hashed:secret", Role.ADMIN, org);
    const { service, refreshRepo, clock } = build([user]);
    const login = await service.login("a@acme.test", "secret");
    const originalHash = hashToken(login.refreshToken);

    clock.advanceBy(1000);
    const refreshed = await service.refresh(login.refreshToken);

    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    const original = await refreshRepo.findByTokenHash(originalHash);
    expect(original?.isRevoked()).toBe(true);
    expect(original?.replacedBy?.tokenHash).toBe(hashToken(refreshed.refreshToken));
  });

  it("rejects refreshing with an unknown token", async () => {
    const { service } = build([]);

    await expect(service.refresh("does-not-exist")).rejects.toThrow(UnauthorizedException);
  });

  it("rejects refreshing with an expired token", async () => {
    const user = new User("a@acme.test", "hashed:secret", Role.ADMIN, org);
    const { service, clock } = build([user]);
    const login = await service.login("a@acme.test", "secret");

    clock.advanceBy(REFRESH_TTL_MS + 1);

    await expect(service.refresh(login.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects refreshing with an already-revoked (reused) token", async () => {
    const user = new User("a@acme.test", "hashed:secret", Role.ADMIN, org);
    const { service } = build([user]);
    const login = await service.login("a@acme.test", "secret");
    await service.refresh(login.refreshToken);

    await expect(service.refresh(login.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it("logout revokes the refresh token", async () => {
    const user = new User("a@acme.test", "hashed:secret", Role.ADMIN, org);
    const { service, refreshRepo } = build([user]);
    const login = await service.login("a@acme.test", "secret");

    await service.logout(login.refreshToken);

    const stored = await refreshRepo.findByTokenHash(hashToken(login.refreshToken));
    expect(stored?.isRevoked()).toBe(true);
  });

  it("logout is a no-op for an unknown token", async () => {
    const { service } = build([]);

    await expect(service.logout("does-not-exist")).resolves.toBeUndefined();
  });
});
