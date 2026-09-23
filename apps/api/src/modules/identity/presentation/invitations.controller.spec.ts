import type { Response } from "express";
import { InvitationsController, InvitationAcceptController } from "./invitations.controller";
import { REFRESH_COOKIE_NAME } from "./refresh-cookie";
import { Invitation } from "../domain/invitation.entity";
import { Organization } from "../domain/organization.entity";
import { User } from "../domain/user.entity";
import { Role } from "../domain/role.enum";
import type { InvitationService } from "../application/invitation.service";
import type { Session } from "../application/auth.service";
import type { Principal } from "../../../common/auth/principal";

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
const principal: Principal = { userId: admin.id, organizationId: org.id, role: Role.ADMIN };

describe("InvitationsController", () => {
  it("create passes the path org id and caller as inviter, returning the link", async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ invitation, rawToken: "raw-token" }),
    } as unknown as InvitationService;
    const controller = new InvitationsController(service);

    const dto = await controller.create(org.id, { email: "invitee@acme.test", role: Role.VIEWER }, principal);

    expect(service.create).toHaveBeenCalledWith(org.id, admin.id, "invitee@acme.test", Role.VIEWER);
    expect(dto.link).toBe("/accept-invite/raw-token");
  });

  it("list maps every invitation for the organization", async () => {
    const service = {
      listByOrganization: jest.fn().mockResolvedValue([invitation]),
    } as unknown as InvitationService;
    const controller = new InvitationsController(service);

    const dtos = await controller.list(org.id);

    expect(service.listByOrganization).toHaveBeenCalledWith(org.id);
    expect(dtos).toHaveLength(1);
  });

  it("revoke delegates to the service", async () => {
    const service = { revoke: jest.fn().mockResolvedValue(undefined) } as unknown as InvitationService;
    const controller = new InvitationsController(service);

    await controller.revoke(invitation.id);

    expect(service.revoke).toHaveBeenCalledWith(invitation.id);
  });
});

describe("InvitationAcceptController", () => {
  const session: Session = {
    accessToken: "access-token",
    refreshToken: "raw-refresh-token",
    principal,
  };

  it("accepts, sets the refresh cookie, and returns the new session", async () => {
    const service = { accept: jest.fn().mockResolvedValue(session) } as unknown as InvitationService;
    const controller = new InvitationAcceptController(service);
    const res = { cookie: jest.fn() } as unknown as Response;

    const dto = await controller.accept("raw-token", { password: "password123" }, res);

    expect(service.accept).toHaveBeenCalledWith("raw-token", "password123");
    expect(res.cookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, "raw-refresh-token", expect.anything());
    expect(dto.accessToken).toBe("access-token");
  });
});
