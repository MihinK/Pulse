import { FixedClock } from "@pulse/shared";
import { DependencyStatus } from "../domain/health-status";
import { DependencyCheck } from "./dependency-check";
import { HealthCheckService } from "./health-check.service";

class FakeDependencyCheck implements DependencyCheck {
  public constructor(
    public readonly name: string,
    private readonly result: DependencyStatus,
  ) {}

  public async check(): Promise<DependencyStatus> {
    return Promise.resolve(this.result);
  }
}

describe("HealthCheckService", () => {
  const checkedAt = new Date("2026-09-22T10:00:00.000Z");

  it("reports UP when every dependency check reports UP", async () => {
    const clock = new FixedClock(checkedAt);
    const service = new HealthCheckService(
      [
        new FakeDependencyCheck("database", { name: "database", state: "UP" }),
        new FakeDependencyCheck("queue", { name: "queue", state: "UP" }),
      ],
      clock,
    );

    const status = await service.check();

    expect(status.isUp()).toBe(true);
    expect(status.checkedAt).toEqual(checkedAt);
    expect(status.dependencies).toHaveLength(2);
  });

  it("reports DOWN when any dependency check reports DOWN", async () => {
    const clock = new FixedClock(checkedAt);
    const service = new HealthCheckService(
      [
        new FakeDependencyCheck("database", { name: "database", state: "UP" }),
        new FakeDependencyCheck("queue", {
          name: "queue",
          state: "DOWN",
          detail: "connection refused",
        }),
      ],
      clock,
    );

    const status = await service.check();

    expect(status.isUp()).toBe(false);
    expect(status.dependencies.find((d) => d.name === "queue")?.detail).toBe("connection refused");
  });

  it("reports UP with no dependencies registered", async () => {
    const service = new HealthCheckService([], new FixedClock(checkedAt));

    const status = await service.check();

    expect(status.isUp()).toBe(true);
    expect(status.dependencies).toHaveLength(0);
  });

  it("runs all dependency checks concurrently rather than one at a time", async () => {
    const order: string[] = [];
    const slow: DependencyCheck = {
      name: "slow",
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push("slow");
        return { name: "slow", state: "UP" };
      },
    };
    const fast: DependencyCheck = {
      name: "fast",
      check: () => {
        order.push("fast");
        return Promise.resolve({ name: "fast", state: "UP" });
      },
    };

    const service = new HealthCheckService([slow, fast], new FixedClock(checkedAt));
    await service.check();

    expect(order).toEqual(["fast", "slow"]);
  });
});
