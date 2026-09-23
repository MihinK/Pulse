import { CheckRunStatus } from "@pulse/shared";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "./application.entity";
import { Environment } from "./environment.enum";
import { CheckRun } from "./check-run.entity";
import { CheckTrigger } from "./check-trigger.enum";

describe("CheckRun", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);

  it("starts QUEUED", () => {
    const run = new CheckRun(org, app, CheckTrigger.MANUAL, admin);

    expect(run.status).toBe(CheckRunStatus.QUEUED);
    expect(run.hadFailure()).toBe(false);
  });

  it("transitions to RUNNING", () => {
    const run = new CheckRun(org, app, CheckTrigger.MANUAL, admin);
    const now = new Date();

    run.start(now);

    expect(run.status).toBe(CheckRunStatus.RUNNING);
    expect(run.startedAt).toBe(now);
  });

  it("completes with a summary", () => {
    const run = new CheckRun(org, app, CheckTrigger.MANUAL, admin);
    const now = new Date();

    run.complete(now, { total: 3, passed: 2, failed: 1, skipped: 0, avgMs: 120, p95Ms: 200 });

    expect(run.status).toBe(CheckRunStatus.COMPLETED);
    expect(run.finishedAt).toBe(now);
    expect(run.total).toBe(3);
    expect(run.passed).toBe(2);
    expect(run.failed).toBe(1);
    expect(run.hadFailure()).toBe(true);
    expect(run.avgMs).toBe(120);
    expect(run.p95Ms).toBe(200);
  });

  it("marks a run FAILED", () => {
    const run = new CheckRun(org, app, CheckTrigger.MANUAL, admin);
    const now = new Date();

    run.fail(now);

    expect(run.status).toBe(CheckRunStatus.FAILED);
    expect(run.finishedAt).toBe(now);
  });

  it("has no triggeredBy for a scheduled run", () => {
    const run = new CheckRun(org, app, CheckTrigger.SCHEDULED);

    expect(run.triggeredBy).toBeUndefined();
    expect(run.trigger).toBe(CheckTrigger.SCHEDULED);
  });
});
