import { FixedClock } from "@pulse/shared";
import { RefreshToken } from "./refresh-token.entity";
import { Organization } from "./organization.entity";
import { User } from "./user.entity";
import { Role } from "./role.enum";

describe("RefreshToken", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const user = new User("a@acme.test", "hash", Role.VIEWER, org);
  const now = new Date("2026-01-01T00:00:00.000Z");
  const expiresAt = new Date("2026-01-31T00:00:00.000Z");

  it("is valid until revoked or expired", () => {
    const token = new RefreshToken(user, "hash", expiresAt);
    const clock = new FixedClock(now);

    expect(token.isValid(clock)).toBe(true);
    expect(token.isRevoked()).toBe(false);
  });

  it("is invalid once expired", () => {
    const token = new RefreshToken(user, "hash", expiresAt);
    const clock = new FixedClock(expiresAt);

    expect(token.isValid(clock)).toBe(false);
  });

  it("is invalid once revoked, and records what replaced it", () => {
    const token = new RefreshToken(user, "hash", expiresAt);
    const replacement = new RefreshToken(user, "new-hash", expiresAt);
    const clock = new FixedClock(now);

    token.revoke(clock, replacement);

    expect(token.isRevoked()).toBe(true);
    expect(token.isValid(clock)).toBe(false);
    expect(token.revokedAt).toEqual(now);
    expect(token.replacedBy).toBe(replacement);
  });

  it("is not revoked when hydrated from a NULL revoked_at column (null, not undefined)", () => {
    const token = new RefreshToken(user, "hash", expiresAt);
    // MikroORM hydrates an unset nullable column as `null`, never `undefined` — regression test
    // for a bug where `isRevoked()` used `!== undefined` and so treated every freshly loaded,
    // never-revoked token as already revoked (which would have broken every refresh).
    (token as unknown as { revokedAt: Date | null }).revokedAt = null;

    expect(token.isRevoked()).toBe(false);
  });
});
