import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "./application.entity";
import { Environment } from "./environment.enum";
import { ApplicationStatus } from "./application-status.enum";

describe("Application", () => {
  const org = new Organization("Acme", "acme", "UTC");

  it("starts UNKNOWN with default check settings", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

    expect(app.status).toBe(ApplicationStatus.UNKNOWN);
    expect(app.checkIntervalMinutes).toBe(5);
    expect(app.timeoutMs).toBe(10_000);
    expect(app.slowThresholdMs).toBe(2000);
    expect(app.expectedStatuses).toBeUndefined();
    expect(app.schemaValidation).toBe(false);
    expect(app.tags).toEqual([]);
    expect(app.organizationId()).toBe(org.id);
    expect(app.isDeleted()).toBe(false);
  });

  it("soft-deletes", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

    app.softDelete();

    expect(app.isDeleted()).toBe(true);
    expect(app.deletedAt).toBeInstanceOf(Date);
  });

  it("updates only the fields given", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

    app.update({ name: "API v2", timeoutMs: 5000 });

    expect(app.name).toBe("API v2");
    expect(app.timeoutMs).toBe(5000);
    expect(app.baseUrl).toBe("https://api.acme.test");
    expect(app.environment).toBe(Environment.PROD);
  });

  it("updates expectedStatuses to null (explicit override back to the 2xx/3xx default)", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    app.update({ expectedStatuses: [200, 201] });

    app.update({ expectedStatuses: null });

    expect(app.expectedStatuses).toBeNull();
  });

  it("records a completed run with a failure as DOWN", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

    app.recordCompletedRun(true, false);

    expect(app.status).toBe(ApplicationStatus.DOWN);
  });

  it("records a completed run with no failure but a degraded result as DEGRADED", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

    app.recordCompletedRun(false, true);

    expect(app.status).toBe(ApplicationStatus.DEGRADED);
  });

  it("records a clean completed run as UP", () => {
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

    app.recordCompletedRun(false, false);

    expect(app.status).toBe(ApplicationStatus.UP);
  });
});
