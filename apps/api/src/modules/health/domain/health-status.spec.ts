import { HealthStatus } from "./health-status";

describe("HealthStatus", () => {
  const checkedAt = new Date("2026-09-22T10:00:00.000Z");

  it("is UP when every dependency is UP", () => {
    const status = HealthStatus.from(checkedAt, [
      { name: "database", state: "UP" },
      { name: "queue", state: "UP" },
    ]);

    expect(status.state).toBe("UP");
    expect(status.isUp()).toBe(true);
  });

  it("is DOWN when any dependency is DOWN", () => {
    const status = HealthStatus.from(checkedAt, [
      { name: "database", state: "UP" },
      { name: "queue", state: "DOWN", detail: "connection refused" },
    ]);

    expect(status.state).toBe("DOWN");
    expect(status.isUp()).toBe(false);
  });

  it("is UP when there are no dependencies to check", () => {
    const status = HealthStatus.from(checkedAt, []);

    expect(status.isUp()).toBe(true);
  });

  it("carries the checked-at instant and the dependency list through unchanged", () => {
    const dependencies = [{ name: "database", state: "UP" as const }];
    const status = HealthStatus.from(checkedAt, dependencies);

    expect(status.checkedAt).toBe(checkedAt);
    expect(status.dependencies).toEqual(dependencies);
  });
});
