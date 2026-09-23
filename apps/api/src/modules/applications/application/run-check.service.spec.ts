import { FixedClock } from "@pulse/shared";
import { CheckRunStatus, Outcome } from "@pulse/shared";
import { RunCheckService } from "./run-check.service";
import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { CheckRun } from "../domain/check-run.entity";
import { CheckTrigger } from "../domain/check-trigger.enum";
import { ApplicationStatus } from "../domain/application-status.enum";
import { NoAuthStrategy } from "../infrastructure/auth-strategies";
import type { ApplicationRepository } from "./ports/application-repository";
import type { AuthConfigRepository } from "./ports/auth-config-repository";
import type { CheckResultRepository } from "./ports/check-result-repository";
import type { CheckRunRepository } from "./ports/check-run-repository";
import type { HttpProbe } from "./ports/http-probe";
import type { AuthStrategyFactory } from "../infrastructure/auth-strategy.factory";

describe("RunCheckService", () => {
  const org = new Organization("Acme", "acme", "UTC");

  function build() {
    const checkRuns: jest.Mocked<CheckRunRepository> = {
      findById: jest.fn(),
      findByApplicationId: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const checkResults: jest.Mocked<CheckResultRepository> = {
      findByCheckRunId: jest.fn(),
      saveAll: jest.fn().mockResolvedValue(undefined),
    };
    const applications: jest.Mocked<ApplicationRepository> = {
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const authConfigs: jest.Mocked<AuthConfigRepository> = {
      findByApplicationId: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const httpProbe: jest.Mocked<HttpProbe> = {
      probe: jest.fn(),
    };
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const authStrategies = {
      build: jest.fn().mockReturnValue(new NoAuthStrategy()),
    } as unknown as jest.Mocked<AuthStrategyFactory>;

    const service = new RunCheckService(
      checkRuns,
      checkResults,
      applications,
      authConfigs,
      httpProbe,
      clock,
      authStrategies,
    );
    return { service, checkRuns, checkResults, applications, authConfigs, httpProbe, clock, authStrategies };
  }

  function buildRun(app: Application): CheckRun {
    return new CheckRun(org, app, CheckTrigger.MANUAL);
  }

  it("does nothing when the run no longer exists", async () => {
    const { service, checkRuns, applications } = build();
    checkRuns.findById.mockResolvedValue(null);

    await service.execute("missing");

    expect(applications.findById).not.toHaveBeenCalled();
  });

  it("fails the run when its application no longer exists", async () => {
    const { service, checkRuns, applications } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    const run = buildRun(app);
    checkRuns.findById.mockResolvedValue(run);
    applications.findById.mockResolvedValue(null);

    await service.execute(run.id);

    expect(run.status).toBe(CheckRunStatus.FAILED);
  });

  it("records a PASSED result and marks the application UP", async () => {
    const { service, checkRuns, checkResults, applications, httpProbe } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    const run = buildRun(app);
    checkRuns.findById.mockResolvedValue(run);
    applications.findById.mockResolvedValue(app);
    httpProbe.probe.mockResolvedValue({ statusCode: 200, responseMs: 50 });

    await service.execute(run.id);

    expect(run.status).toBe(CheckRunStatus.COMPLETED);
    expect(run.passed).toBe(1);
    expect(run.failed).toBe(0);
    expect(app.status).toBe(ApplicationStatus.UP);
    const savedResults = checkResults.saveAll.mock.calls[0]?.[0] ?? [];
    expect(savedResults[0]?.outcome).toBe(Outcome.PASSED);
  });

  it("records a DEGRADED result when the response is slower than the threshold", async () => {
    const { service, checkRuns, applications, httpProbe } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    app.update({ slowThresholdMs: 100 });
    const run = buildRun(app);
    checkRuns.findById.mockResolvedValue(run);
    applications.findById.mockResolvedValue(app);
    httpProbe.probe.mockResolvedValue({ statusCode: 200, responseMs: 500 });

    await service.execute(run.id);

    expect(run.passed).toBe(1);
    expect(app.status).toBe(ApplicationStatus.DEGRADED);
  });

  it("records a FAILED result for an unexpected status code", async () => {
    const { service, checkRuns, applications, httpProbe } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    const run = buildRun(app);
    checkRuns.findById.mockResolvedValue(run);
    applications.findById.mockResolvedValue(app);
    httpProbe.probe.mockResolvedValue({ statusCode: 500, responseMs: 20 });

    await service.execute(run.id);

    expect(run.failed).toBe(1);
    expect(app.status).toBe(ApplicationStatus.DOWN);
  });

  it("honors an explicit expectedStatuses override", async () => {
    const { service, checkRuns, applications, httpProbe } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    app.update({ expectedStatuses: [201] });
    const run = buildRun(app);
    checkRuns.findById.mockResolvedValue(run);
    applications.findById.mockResolvedValue(app);
    httpProbe.probe.mockResolvedValue({ statusCode: 200, responseMs: 20 });

    await service.execute(run.id);

    expect(run.failed).toBe(1);
  });

  it("records a FAILED result when the probe itself errors", async () => {
    const { service, checkRuns, applications, httpProbe } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    const run = buildRun(app);
    checkRuns.findById.mockResolvedValue(run);
    applications.findById.mockResolvedValue(app);
    httpProbe.probe.mockResolvedValue({ responseMs: 20, error: "connect ECONNREFUSED" });

    await service.execute(run.id);

    expect(run.failed).toBe(1);
    expect(app.status).toBe(ApplicationStatus.DOWN);
  });

  it("records a FAILED result when the probe returns neither a status code nor an error", async () => {
    const { service, checkRuns, applications, httpProbe } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    const run = buildRun(app);
    checkRuns.findById.mockResolvedValue(run);
    applications.findById.mockResolvedValue(app);
    httpProbe.probe.mockResolvedValue({ responseMs: 20 });

    await service.execute(run.id);

    expect(run.failed).toBe(1);
  });

  it("fails the run and rethrows when the probe throws unexpectedly", async () => {
    const { service, checkRuns, applications, httpProbe } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    const run = buildRun(app);
    checkRuns.findById.mockResolvedValue(run);
    applications.findById.mockResolvedValue(app);
    httpProbe.probe.mockRejectedValue(new Error("boom"));

    await expect(service.execute(run.id)).rejects.toThrow("boom");
    expect(run.status).toBe(CheckRunStatus.FAILED);
  });
});
