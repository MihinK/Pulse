import { NotFoundException } from "@nestjs/common";
import { UsersController, OrganizationUsersController } from "./users.controller";
import { User } from "../domain/user.entity";
import { Organization } from "../domain/organization.entity";
import { Role } from "../domain/role.enum";
import type { ProfileService } from "../application/profile.service";
import type { OrganizationService } from "../application/organization.service";
import type { Principal } from "../../../common/auth/principal";

const org = new Organization("Acme", "acme", "UTC");
const user = new User("a@acme.test", "hash", Role.VIEWER, org);
const principal: Principal = { userId: user.id, organizationId: org.id, role: Role.VIEWER };

describe("UsersController", () => {
  it("getSelf returns the caller's own profile", async () => {
    const service = { getSelf: jest.fn().mockResolvedValue(user) } as unknown as ProfileService;
    const controller = new UsersController(service);

    const dto = await controller.getSelf(principal);

    expect(service.getSelf).toHaveBeenCalledWith(user.id);
    expect(dto.id).toBe(user.id);
  });

  it("updateSelf updates the caller's time zone", async () => {
    const service = {
      updateTimeZone: jest.fn().mockResolvedValue(user),
    } as unknown as ProfileService;
    const controller = new UsersController(service);

    await controller.updateSelf(principal, { timeZone: "America/New_York" });

    expect(service.updateTimeZone).toHaveBeenCalledWith(user.id, "America/New_York");
  });
});

describe("OrganizationUsersController", () => {
  it("lists users for the given organization once it confirms the org is visible", async () => {
    const profile = {
      listByOrganization: jest.fn().mockResolvedValue([user]),
    } as unknown as ProfileService;
    const organizations = {
      getById: jest.fn().mockResolvedValue(org),
    } as unknown as OrganizationService;
    const controller = new OrganizationUsersController(profile, organizations);

    const dtos = await controller.listByOrganization(org.id);

    expect(organizations.getById).toHaveBeenCalledWith(org.id);
    expect(profile.listByOrganization).toHaveBeenCalledWith(org.id);
    expect(dtos).toHaveLength(1);
  });

  it("propagates 404 for an organization the caller cannot see, without listing anyone", async () => {
    const profile = { listByOrganization: jest.fn() } as unknown as ProfileService;
    const organizations = {
      getById: jest.fn().mockRejectedValue(new NotFoundException("Organization not found")),
    } as unknown as OrganizationService;
    const controller = new OrganizationUsersController(profile, organizations);

    await expect(controller.listByOrganization("other-org-id")).rejects.toThrow(
      NotFoundException,
    );
    expect(profile.listByOrganization).not.toHaveBeenCalled();
  });
});
