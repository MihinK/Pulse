import { InvitationResponseDto } from "./invitation-response.dto";
import { Invitation } from "../../domain/invitation.entity";
import { Organization } from "../../domain/organization.entity";
import { User } from "../../domain/user.entity";
import { Role } from "../../domain/role.enum";
import { FixedClock } from "@pulse/shared";

describe("InvitationResponseDto.fromDomain", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const invitation = new Invitation(
    org,
    "invitee@acme.test",
    Role.VIEWER,
    "token-hash",
    new Date("2026-02-01T00:00:00.000Z"),
    admin,
  );

  it("maps a pending invitation, with no acceptedAt and no link by default", () => {
    const dto = InvitationResponseDto.fromDomain(invitation);

    expect(dto.email).toBe("invitee@acme.test");
    expect(dto.role).toBe(Role.VIEWER);
    expect(dto.expiresAt).toBe(invitation.expiresAt.toISOString());
    expect(dto.acceptedAt).toBeNull();
    expect(dto.link).toBeUndefined();
  });

  it("includes the link when one is given (the create response)", () => {
    const dto = InvitationResponseDto.fromDomain(invitation, "/accept-invite/raw-token");

    expect(dto.link).toBe("/accept-invite/raw-token");
  });

  it("reflects acceptedAt once accepted", () => {
    const clock = new FixedClock(new Date("2026-01-15T00:00:00.000Z"));
    invitation.accept(clock);

    const dto = InvitationResponseDto.fromDomain(invitation);

    expect(dto.acceptedAt).toBe(invitation.acceptedAt?.toISOString());
  });
});
