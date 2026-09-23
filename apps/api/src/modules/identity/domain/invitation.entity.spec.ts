import { FixedClock } from "@pulse/shared";
import {
  Invitation,
  InvitationAlreadyAcceptedError,
  InvitationExpiredError,
} from "./invitation.entity";
import { Organization } from "./organization.entity";
import { User } from "./user.entity";
import { Role } from "./role.enum";

describe("Invitation", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const now = new Date("2026-01-01T00:00:00.000Z");
  const expiresAt = new Date("2026-01-08T00:00:00.000Z");

  const build = (): Invitation =>
    new Invitation(org, "invitee@acme.test", Role.VIEWER, "token-hash", expiresAt, admin);

  it("is not accepted or expired when freshly created", () => {
    const invitation = build();
    const clock = new FixedClock(now);

    expect(invitation.isAccepted()).toBe(false);
    expect(invitation.isExpired(clock)).toBe(false);
  });

  it("is expired once the clock passes expiresAt", () => {
    const invitation = build();
    const clock = new FixedClock(expiresAt);

    expect(invitation.isExpired(clock)).toBe(true);
  });

  it("accepts, recording the acceptance instant", () => {
    const invitation = build();
    const clock = new FixedClock(now);

    invitation.accept(clock);

    expect(invitation.isAccepted()).toBe(true);
    expect(invitation.acceptedAt).toEqual(now);
  });

  it("refuses to accept twice", () => {
    const invitation = build();
    const clock = new FixedClock(now);
    invitation.accept(clock);

    expect(() => invitation.accept(clock)).toThrow(InvitationAlreadyAcceptedError);
  });

  it("refuses to accept once expired", () => {
    const invitation = build();
    const clock = new FixedClock(expiresAt);

    expect(() => invitation.accept(clock)).toThrow(InvitationExpiredError);
  });

  it("is not accepted when hydrated from a NULL accepted_at column (null, not undefined)", () => {
    const invitation = build();
    // MikroORM hydrates an unset nullable column as `null`, never `undefined` — regression test
    // for a bug where `isAccepted()` used `!== undefined` and so treated every freshly loaded,
    // never-accepted invitation as already accepted.
    (invitation as unknown as { acceptedAt: Date | null }).acceptedAt = null;

    expect(invitation.isAccepted()).toBe(false);
  });
});
