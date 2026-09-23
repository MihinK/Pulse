import { ForbiddenException } from "@nestjs/common";
import { ApplicationRunsController, RunsController } from "./runs.controller";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { CheckRun } from "../domain/check-run.entity";
import { CheckTrigger } from "../domain/check-trigger.enum";
import { CheckResult } from "../domain/check-result.entity";
import { Outcome } from "@pulse/shared";
import type { Principal } from "../../../common/auth/principal";
import type { ApplicationService } from "../application/application.service";
import type { RunService } from "../application/run.service";
import type { OrganizationService } from "../../identity/application/organization.service";
import type { ProfileService } from "../../identity/application/profile.service";

describe("ApplicationRunsController", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const run = new CheckRun(org, app, CheckTrigger.MANUAL, admin);
  const principal: Principal = { userId: admin.id, organizationId: org.id, role: Role.ADMIN };

  function build() {
    const applications = {
      getById: jest.fn().mockResolvedValue(app),
    } as unknown as jest.Mocked<ApplicationService>;
    const runs = {
      startManualRun: jest.fn().mockResolvedValue(run),
      listForApplication: jest.fn().mockResolvedValue([run]),
    } as unknown as jest.Mocked<RunService>;
    const organizations = {
      getById: jest.fn().mockResolvedValue(org),
    } as unknown as jest.Mocked<OrganizationService>;
    const profile = {
      getSelf: jest.fn().mockResolvedValue(admin),
    } as unknown as jest.Mocked<ProfileService>;
    const controller = new ApplicationRunsController(applications, runs, organizations, profile);
    return { controller, applications, runs, organizations, profile };
  }

  it("startManualRun resolves the application, organization, and actor, then starts a run", async () => {
    const { controller, applications, organizations, profile, runs } = build();

    const dto = await controller.startManualRun(principal, app.id);

    expect(applications.getById).toHaveBeenCalledWith(app.id);
    expect(organizations.getById).toHaveBeenCalledWith(org.id);
    expect(profile.getSelf).toHaveBeenCalledWith(admin.id);
    expect(runs.startManualRun).toHaveBeenCalledWith(org, app, admin);
    expect(dto.id).toBe(run.id);
  });

  it("startManualRun refuses a principal with no organization", async () => {
    const { controller } = build();
    const platformOwner: Principal = { userId: "owner-1", organizationId: null, role: Role.PLATFORM_OWNER };

    await expect(controller.startManualRun(platformOwner, app.id)).rejects.toThrow(ForbiddenException);
  });

  it("list 404s through getById before listing runs", async () => {
    const { controller, applications, runs } = build();

    const dtos = await controller.list(app.id);

    expect(applications.getById).toHaveBeenCalledWith(app.id);
    expect(runs.listForApplication).toHaveBeenCalledWith(app.id);
    expect(dtos).toHaveLength(1);
  });
});

describe("RunsController", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const run = new CheckRun(org, app, CheckTrigger.MANUAL);
  const result = new CheckResult(run, app.baseUrl, Outcome.PASSED, { statusCode: 200, responseMs: 10 });

  function build() {
    const runs = {
      getRun: jest.fn().mockResolvedValue(run),
      getResults: jest.fn().mockResolvedValue([result]),
    } as unknown as jest.Mocked<RunService>;
    return { controller: new RunsController(runs), runs };
  }

  it("getById maps a single run", async () => {
    const { controller, runs } = build();

    const dto = await controller.getById(run.id);

    expect(runs.getRun).toHaveBeenCalledWith(run.id);
    expect(dto.id).toBe(run.id);
  });

  it("getResults maps every result", async () => {
    const { controller, runs } = build();

    const dtos = await controller.getResults(run.id);

    expect(runs.getResults).toHaveBeenCalledWith(run.id);
    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.outcome).toBe(Outcome.PASSED);
  });
});
