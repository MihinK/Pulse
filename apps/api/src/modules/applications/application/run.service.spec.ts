import { NotFoundException } from "@nestjs/common";
import { RunService } from "./run.service";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { CheckRun } from "../domain/check-run.entity";
import { CheckTrigger } from "../domain/check-trigger.enum";
import { CheckResult } from "../domain/check-result.entity";
import { Outcome } from "@pulse/shared";
import type { CheckRunRepository } from "./ports/check-run-repository";
import type { CheckResultRepository } from "./ports/check-result-repository";
import type { OutboxRepository } from "./ports/outbox-repository";

describe("RunService", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);

  function build() {
    const checkRuns: jest.Mocked<CheckRunRepository> = {
      findById: jest.fn(),
      findByApplicationId: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const checkResults: jest.Mocked<CheckResultRepository> = {
      findByCheckRunId: jest.fn(),
      saveAll: jest.fn(),
    };
    const outbox: jest.Mocked<OutboxRepository> = {
      save: jest.fn().mockResolvedValue(undefined),
      findUnprocessed: jest.fn(),
      markProcessed: jest.fn(),
    };
    const service = new RunService(checkRuns, checkResults, outbox);
    return { service, checkRuns, checkResults, outbox };
  }

  it("starts a manual run and writes a matching outbox entry", async () => {
    const { service, checkRuns, outbox } = build();

    const run = await service.startManualRun(org, app, admin);

    expect(checkRuns.save).toHaveBeenCalledWith(run);
    expect(outbox.save).toHaveBeenCalledTimes(1);
    const entry = outbox.save.mock.calls[0]?.[0];
    expect(entry?.kind).toBe("run.queued");
    expect(entry?.payload).toEqual({ checkRunId: run.id });
  });

  it("getRun throws when the run does not exist", async () => {
    const { service, checkRuns } = build();
    checkRuns.findById.mockResolvedValue(null);

    await expect(service.getRun("missing")).rejects.toThrow(NotFoundException);
  });

  it("getRun returns the run when found", async () => {
    const { service, checkRuns } = build();
    const run = new CheckRun(org, app, CheckTrigger.MANUAL, admin);
    checkRuns.findById.mockResolvedValue(run);

    await expect(service.getRun(run.id)).resolves.toBe(run);
  });

  it("listForApplication delegates to the repository", async () => {
    const { service, checkRuns } = build();
    checkRuns.findByApplicationId.mockResolvedValue([]);

    await service.listForApplication(app.id, 10);

    expect(checkRuns.findByApplicationId).toHaveBeenCalledWith(app.id, 10);
  });

  it("listForApplication defaults to a limit of 20", async () => {
    const { service, checkRuns } = build();
    checkRuns.findByApplicationId.mockResolvedValue([]);

    await service.listForApplication(app.id);

    expect(checkRuns.findByApplicationId).toHaveBeenCalledWith(app.id, 20);
  });

  it("getResults 404s through getRun before fetching results", async () => {
    const { service, checkRuns } = build();
    checkRuns.findById.mockResolvedValue(null);

    await expect(service.getResults("missing")).rejects.toThrow(NotFoundException);
  });

  it("getResults returns results once the run is confirmed", async () => {
    const { service, checkRuns, checkResults } = build();
    const run = new CheckRun(org, app, CheckTrigger.MANUAL, admin);
    checkRuns.findById.mockResolvedValue(run);
    const result = new CheckResult(run, app.baseUrl, Outcome.PASSED, { statusCode: 200, responseMs: 10 });
    checkResults.findByCheckRunId.mockResolvedValue([result]);

    const results = await service.getResults(run.id);

    expect(results).toEqual([result]);
  });
});
