import { CheckRunResponseDto } from "./check-run-response.dto";
import { Organization } from "../../../identity/domain/organization.entity";
import { Application } from "../../domain/application.entity";
import { Environment } from "../../domain/environment.enum";
import { CheckRun } from "../../domain/check-run.entity";
import { CheckTrigger } from "../../domain/check-trigger.enum";

describe("CheckRunResponseDto.fromDomain", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

  it("maps a queued run without started/finished timestamps", () => {
    const run = new CheckRun(org, app, CheckTrigger.MANUAL);

    const dto = CheckRunResponseDto.fromDomain(run);

    expect(dto.id).toBe(run.id);
    expect(dto.applicationId).toBe(app.id);
    expect(dto.status).toBe("QUEUED");
    expect(dto.startedAt).toBeUndefined();
    expect(dto.finishedAt).toBeUndefined();
    expect(dto.avgMs).toBeUndefined();
  });

  it("maps a completed run with all fields", () => {
    const run = new CheckRun(org, app, CheckTrigger.MANUAL);
    const now = new Date();
    run.start(now);
    run.complete(now, { total: 1, passed: 1, failed: 0, skipped: 0, avgMs: 42, p95Ms: 42 });

    const dto = CheckRunResponseDto.fromDomain(run);

    expect(dto.status).toBe("COMPLETED");
    expect(dto.startedAt).toBe(now.toISOString());
    expect(dto.finishedAt).toBe(now.toISOString());
    expect(dto.avgMs).toBe(42);
    expect(dto.p95Ms).toBe(42);
  });
});
