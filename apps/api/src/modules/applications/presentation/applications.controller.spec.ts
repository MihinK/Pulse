import { ForbiddenException } from "@nestjs/common";
import { ApplicationsController } from "./applications.controller";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { AuthType } from "../domain/auth-type.enum";
import type { Principal } from "../../../common/auth/principal";
import type { ApplicationService } from "../application/application.service";
import type { AuthConfigService } from "../application/auth-config.service";
import type { OrganizationService } from "../../identity/application/organization.service";
import type { ProfileService } from "../../identity/application/profile.service";

describe("ApplicationsController", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const principal: Principal = { userId: admin.id, organizationId: org.id, role: Role.ADMIN };

  function build() {
    const applications = {
      create: jest.fn().mockResolvedValue(app),
      list: jest.fn().mockResolvedValue([app]),
      getById: jest.fn().mockResolvedValue(app),
      update: jest.fn().mockResolvedValue(app),
      softDelete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ApplicationService>;
    const authConfigs = {
      get: jest.fn().mockResolvedValue({ type: AuthType.NONE }),
      set: jest.fn().mockResolvedValue({ type: AuthType.BEARER }),
    } as unknown as jest.Mocked<AuthConfigService>;
    const organizations = {
      getById: jest.fn().mockResolvedValue(org),
    } as unknown as jest.Mocked<OrganizationService>;
    const profile = {
      getSelf: jest.fn().mockResolvedValue(admin),
    } as unknown as jest.Mocked<ProfileService>;
    const controller = new ApplicationsController(applications, authConfigs, organizations, profile);
    return { controller, applications, authConfigs, organizations, profile };
  }

  it("create resolves the acting organization and user, then delegates to the service", async () => {
    const { controller, applications, organizations, profile } = build();

    const dto = await controller.create(principal, {
      name: "API",
      baseUrl: "https://api.acme.test",
      environment: Environment.PROD,
    });

    expect(organizations.getById).toHaveBeenCalledWith(org.id);
    expect(profile.getSelf).toHaveBeenCalledWith(admin.id);
    expect(applications.create).toHaveBeenCalledWith(org, admin, expect.objectContaining({ name: "API" }));
    expect(dto.id).toBe(app.id);
  });

  it("create refuses a principal with no organization", async () => {
    const { controller } = build();
    const platformOwner: Principal = { userId: "owner-1", organizationId: null, role: Role.PLATFORM_OWNER };

    await expect(
      controller.create(platformOwner, { name: "API", baseUrl: "https://api.acme.test", environment: Environment.PROD }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("list maps every application", async () => {
    const { controller, applications } = build();

    const dtos = await controller.list();

    expect(applications.list).toHaveBeenCalledWith({ status: undefined, environment: undefined, search: undefined });
    expect(dtos).toHaveLength(1);
  });

  it("getById maps a single application", async () => {
    const { controller, applications } = build();

    const dto = await controller.getById(app.id);

    expect(applications.getById).toHaveBeenCalledWith(app.id);
    expect(dto.id).toBe(app.id);
  });

  it("update delegates the patch", async () => {
    const { controller, applications } = build();

    await controller.update(app.id, { name: "API v2" });

    expect(applications.update).toHaveBeenCalledWith(app.id, { name: "API v2" });
  });

  it("softDelete delegates to the service", async () => {
    const { controller, applications } = build();

    await controller.softDelete(app.id);

    expect(applications.softDelete).toHaveBeenCalledWith(app.id);
  });

  it("getAuthConfig returns only the type", async () => {
    const { controller, authConfigs } = build();

    const dto = await controller.getAuthConfig(app.id);

    expect(authConfigs.get).toHaveBeenCalledWith(app.id);
    expect(dto.type).toBe(AuthType.NONE);
  });

  it("setAuthConfig forwards type and credentials", async () => {
    const { controller, authConfigs } = build();

    await controller.setAuthConfig(app.id, { type: AuthType.BEARER, credentials: { token: "x" } });

    expect(authConfigs.set).toHaveBeenCalledWith(app.id, AuthType.BEARER, { token: "x" });
  });
});
