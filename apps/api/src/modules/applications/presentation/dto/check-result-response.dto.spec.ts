import { Outcome } from "@pulse/shared";
import { CheckResultResponseDto } from "./check-result-response.dto";
import { Organization } from "../../../identity/domain/organization.entity";
import { Application } from "../../domain/application.entity";
import { Environment } from "../../domain/environment.enum";
import { CheckRun } from "../../domain/check-run.entity";
import { CheckTrigger } from "../../domain/check-trigger.enum";
import { CheckResult } from "../../domain/check-result.entity";

describe("CheckResultResponseDto.fromDomain", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const run = new CheckRun(org, app, CheckTrigger.MANUAL);

  it("maps a passed result", () => {
    const result = new CheckResult(run, app.baseUrl, Outcome.PASSED, { statusCode: 200, responseMs: 42 });

    const dto = CheckResultResponseDto.fromDomain(result);

    expect(dto.method).toBe("GET");
    expect(dto.statusCode).toBe(200);
    expect(dto.responseMs).toBe(42);
    expect(dto.outcome).toBe(Outcome.PASSED);
    expect(dto.failureReason).toBeUndefined();
  });

  it("maps a failed result with no status code", () => {
    const result = new CheckResult(run, app.baseUrl, Outcome.FAILED, { failureReason: "timeout" });

    const dto = CheckResultResponseDto.fromDomain(result);

    expect(dto.statusCode).toBeUndefined();
    expect(dto.failureReason).toBe("timeout");
  });
});
