import { BadRequestException, NotFoundException } from "@nestjs/common";
import { FixedClock } from "@pulse/shared";
import { InvitationService } from "./invitation.service";
import { AuthService, hashToken } from "./auth.service";
import { Invitation } from "../domain/invitation.entity";
import { Organization } from "../domain/organization.entity";
import { User } from "../domain/user.entity";
import { RefreshToken } from "../domain/refresh-token.entity";
import { Role } from "../domain/role.enum";
import type { InvitationRepository } from "./ports/invitation-repository";
import type { OrganizationRepository } from "./ports/organization-repository";
import type { UserRepository } from "./ports/user-repository";
import type { RefreshTokenRepository } from "./ports/refresh-token-repository";
import type { PasswordHasher } from "./ports/password-hasher";
import type { TokenService } from "../../../common/auth/token-service";
import type { Principal } from "../../../common/auth/principal";

class FakeInvitationRepository implements InvitationRepository {
  public readonly byId = new Map<string, Invitation>();
  public readonly removed: Invitation[] = [];
  public constructor(invitations: Invitation[]) {
    invitations.forEach((i) => this.byId.set(i.id, i));
  }
  public findById(id: string): Promise<Invitation | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }
  public findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return Promise.resolve([...this.byId.values()].find((i) => i.tokenHash === tokenHash) ?? null);
  }
  public findByOrganization(organizationId: string): Promise<Invitation[]> {
    return Promise.resolve(
      [...this.byId.values()].filter((i) => i.organization.id === organizationId),
    );
  }
  public save(invitation: Invitation): Promise<void> {
    this.byId.set(invitation.id, invitation);
    return Promise.resolve();
  }
  public remove(invitation: Invitation): Promise<void> {
    this.byId.delete(invitation.id);
    this.removed.push(invitation);
    return Promise.resolve();
  }
}

class FakeOrganizationRepository implements OrganizationRepository {
  public constructor(private readonly org: Organization | null) {}
  public findById(id: string): Promise<Organization | null> {
    return Promise.resolve(this.org && this.org.id === id ? this.org : null);
  }
  public findBySlug(): Promise<Organization | null> {
    return Promise.resolve(null);
  }
  public findAll(): Promise<Organization[]> {
    return Promise.resolve(this.org ? [this.org] : []);
  }
  public save(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeUserRepository implements UserRepository {
  public readonly saved: User[] = [];
  public constructor(private readonly byId: Map<string, User> = new Map()) {}
  public findById(id: string): Promise<User | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }
  public findAllByEmailAcrossOrgs(): Promise<User[]> {
    return Promise.resolve([]);
  }
  public findByOrganization(): Promise<User[]> {
    return Promise.resolve([]);
  }
  public countPlatformOwners(): Promise<number> {
    return Promise.resolve(0);
  }
  public save(user: User): Promise<void> {
    this.saved.push(user);
    this.byId.set(user.id, user);
    return Promise.resolve();
  }
}

class FakeRefreshTokenRepository implements RefreshTokenRepository {
  public findByTokenHash(): Promise<RefreshToken | null> {
    return Promise.resolve(null);
  }
  public save(): Promise<void> {
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
  public signAccessToken(principal: Principal): string {
    return `access-token-for-${principal.userId}`;
  }
  public verifyAccessToken(): Principal {
    throw new Error("not used in these tests");
  }
}

describe("InvitationService", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const now = new Date("2026-01-01T00:00:00.000Z");
  const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  function build(invitations: Invitation[] = []): {
    service: InvitationService;
    invitationRepo: FakeInvitationRepository;
    userRepo: FakeUserRepository;
    clock: FixedClock;
  } {
    const invitationRepo = new FakeInvitationRepository(invitations);
    const organizationRepo = new FakeOrganizationRepository(org);
    const userRepo = new FakeUserRepository(new Map([[admin.id, admin]]));
    const clock = new FixedClock(now);
    const authService = new AuthService(
      userRepo,
      new FakeRefreshTokenRepository(),
      new FakePasswordHasher(),
      new FakeTokenService(),
      clock,
      30 * 24 * 60 * 60 * 1000,
    );
    const service = new InvitationService(
      invitationRepo,
      organizationRepo,
      userRepo,
      new FakePasswordHasher(),
      clock,
      INVITATION_TTL_MS,
      authService,
    );
    return { service, invitationRepo, userRepo, clock };
  }

  it("creates an invitation and returns the raw token", async () => {
    const { service, invitationRepo } = build();

    const { invitation, rawToken } = await service.create(
      org.id,
      admin.id,
      "invitee@acme.test",
      Role.VIEWER,
    );

    expect(invitation.tokenHash).toBe(hashToken(rawToken));
    expect(invitationRepo.byId.get(invitation.id)).toBe(invitation);
  });

  it("refuses to create an invitation for an organization the caller cannot see", async () => {
    const { service } = build();

    await expect(
      service.create("some-other-org-id", admin.id, "invitee@acme.test", Role.VIEWER),
    ).rejects.toThrow(NotFoundException);
  });

  it("refuses to create an invitation from an unknown inviter", async () => {
    const { service } = build();

    await expect(
      service.create(org.id, "unknown-user-id", "invitee@acme.test", Role.VIEWER),
    ).rejects.toThrow(NotFoundException);
  });

  it("lists invitations for an organization", async () => {
    const { service } = build();
    await service.create(org.id, admin.id, "a@acme.test", Role.VIEWER);
    await service.create(org.id, admin.id, "b@acme.test", Role.ADMIN);

    const list = await service.listByOrganization(org.id);

    expect(list).toHaveLength(2);
  });

  it("revokes a pending invitation", async () => {
    const { service, invitationRepo } = build();
    const { invitation } = await service.create(org.id, admin.id, "a@acme.test", Role.VIEWER);

    await service.revoke(invitation.id);

    expect(invitationRepo.removed).toContain(invitation);
  });

  it("refuses to revoke an already-accepted invitation", async () => {
    const { service } = build();
    const { invitation, rawToken } = await service.create(
      org.id,
      admin.id,
      "a@acme.test",
      Role.VIEWER,
    );
    await service.accept(rawToken, "password123");

    await expect(service.revoke(invitation.id)).rejects.toThrow(BadRequestException);
  });

  it("revoke throws when the invitation does not exist", async () => {
    const { service } = build();

    await expect(service.revoke("missing")).rejects.toThrow(NotFoundException);
  });

  it("accepts a valid invitation, creating a user and issuing a session", async () => {
    const { service, userRepo } = build();
    const { rawToken } = await service.create(
      org.id,
      admin.id,
      "invitee@acme.test",
      Role.VIEWER,
    );

    const session = await service.accept(rawToken, "password123");

    const created = userRepo.saved.find((u) => u.email === "invitee@acme.test");
    expect(created?.role).toBe(Role.VIEWER);
    expect(session.principal.organizationId).toBe(org.id);
  });

  it("rejects an unknown token", async () => {
    const { service } = build();

    await expect(service.accept("does-not-exist", "password123")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejects accepting the same invitation twice", async () => {
    const { service } = build();
    const { rawToken } = await service.create(
      org.id,
      admin.id,
      "invitee@acme.test",
      Role.VIEWER,
    );
    await service.accept(rawToken, "password123");

    await expect(service.accept(rawToken, "password123")).rejects.toThrow(BadRequestException);
  });

  it("rejects an expired invitation", async () => {
    const { service, clock } = build();
    const { rawToken } = await service.create(
      org.id,
      admin.id,
      "invitee@acme.test",
      Role.VIEWER,
    );

    clock.advanceBy(INVITATION_TTL_MS + 1);

    await expect(service.accept(rawToken, "password123")).rejects.toThrow(BadRequestException);
  });
});
