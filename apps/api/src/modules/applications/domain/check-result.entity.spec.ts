import { Outcome } from "@pulse/shared";
import { Organization } from "../../identity/domain/organization.entity";
import { User } from "../../identity/domain/user.entity";
import { Role } from "../../identity/domain/role.enum";
import { Application } from "./application.entity";
import { Environment } from "./environment.enum";
import { CheckRun } from "./check-run.entity";
import { CheckTrigger } from "./check-trigger.enum";
import { CheckResult } from "./check-result.entity";

describe("CheckResult", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const admin = new User("admin@acme.test", "hash", Role.ADMIN, org);
  const run = new CheckRun(org, app, CheckTrigger.MANUAL, admin);

  it("defaults to method GET", () => {
    const result = new CheckResult(run, "https://api.acme.test", Outcome.PASSED, {
      statusCode: 200,
      responseMs: 42,
    });

    expect(result.method).toBe("GET");
    expect(result.statusCode).toBe(200);
    expect(result.responseMs).toBe(42);
    expect(result.outcome).toBe(Outcome.PASSED);
  });

  it("carries a failure reason with no status code for a network failure", () => {
    const result = new CheckResult(run, "https://api.acme.test", Outcome.FAILED, {
      failureReason: "connect ECONNREFUSED",
    });

    expect(result.statusCode).toBeUndefined();
    expect(result.failureReason).toBe("connect ECONNREFUSED");
  });
});
