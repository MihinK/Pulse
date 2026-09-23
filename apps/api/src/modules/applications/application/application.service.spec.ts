import { NotFoundException } from "@nestjs/common";
import { ApplicationService } from "./application.service";
import { RunService } from "./run.service";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { CheckRun } from "../domain/check-run.entity";
import { CheckTrigger } from "../domain/check-trigger.enum";
import type { ApplicationRepository } from "./ports/application-repository";
import type { AuthConfigRepository } from "./ports/auth-config-repository";
import type { AuditLogRepository } from "./ports/audit-log-repository";

describe("ApplicationService", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);

  function build() {
    const applications: jest.Mocked<ApplicationRepository> = {
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const authConfigs: jest.Mocked<AuthConfigRepository> = {
      findByApplicationId: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const auditLogs: jest.Mocked<AuditLogRepository> = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const runs = {
      startManualRun: jest
        .fn()
        .mockImplementation(
          (organization: Organization, application: Application, actor: User) =>
            Promise.resolve(new CheckRun(organization, application, CheckTrigger.MANUAL, actor)),
        ),
    } as unknown as jest.Mocked<RunService>;
    const service = new ApplicationService(applications, authConfigs, auditLogs, runs);
    return { service, applications, authConfigs, auditLogs, runs };
  }

  it("creates an application with a default NONE auth config, a first run, and an audit log", async () => {
    const { service, applications, authConfigs, auditLogs, runs } = build();

    const app = await service.create(org, admin, {
      name: "API",
      baseUrl: "https://api.acme.test",
      environment: Environment.PROD,
    });

    expect(applications.save).toHaveBeenCalledWith(app);
    expect(authConfigs.save).toHaveBeenCalledTimes(1);
    expect(runs.startManualRun).toHaveBeenCalledWith(org, app, admin);
    expect(auditLogs.save).toHaveBeenCalledTimes(1);
    const log = auditLogs.save.mock.calls[0]?.[0];
    expect(log?.action).toBe("application.created");
  });

  it("applies optional fields given at creation", async () => {
    const { service } = build();

    const app = await service.create(org, admin, {
      name: "API",
      baseUrl: "https://api.acme.test",
      environment: Environment.PROD,
      description: "desc",
      tags: ["a", "b"],
      checkIntervalMinutes: 15,
      timeoutMs: 3000,
      slowThresholdMs: 500,
    });

    expect(app.description).toBe("desc");
    expect(app.tags).toEqual(["a", "b"]);
    expect(app.checkIntervalMinutes).toBe(15);
    expect(app.timeoutMs).toBe(3000);
    expect(app.slowThresholdMs).toBe(500);
  });

  it("list delegates to the repository with the given filter", async () => {
    const { service, applications } = build();
    applications.findAll.mockResolvedValue([]);

    await service.list({ search: "api" });

    expect(applications.findAll).toHaveBeenCalledWith({ search: "api" });
  });

  it("getById throws when missing", async () => {
    const { service, applications } = build();
    applications.findById.mockResolvedValue(null);

    await expect(service.getById("missing")).rejects.toThrow(NotFoundException);
  });

  it("getById throws for a soft-deleted application", async () => {
    const { service, applications } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    app.softDelete();
    applications.findById.mockResolvedValue(app);

    await expect(service.getById(app.id)).rejects.toThrow(NotFoundException);
  });

  it("update applies partial fields", async () => {
    const { service, applications } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    applications.findById.mockResolvedValue(app);

    const updated = await service.update(app.id, { name: "API v2" });

    expect(updated.name).toBe("API v2");
    expect(applications.save).toHaveBeenCalledWith(app);
  });

  it("softDelete marks the application deleted", async () => {
    const { service, applications } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    applications.findById.mockResolvedValue(app);

    await service.softDelete(app.id);

    expect(app.isDeleted()).toBe(true);
    expect(applications.save).toHaveBeenCalledWith(app);
  });
});
