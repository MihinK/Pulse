import { HttpStatus } from "@nestjs/common";
import { HealthStatus } from "../domain/health-status";
import { HealthCheckService } from "../application/health-check.service";
import { HealthController } from "./health.controller";

function fakeResponse() {
  return {
    status: jest.fn().mockReturnThis(),
  };
}

describe("HealthController", () => {
  const checkedAt = new Date("2026-09-22T10:00:00.000Z");

  function serviceReturning(status: HealthStatus): HealthCheckService {
    return { check: jest.fn().mockResolvedValue(status) } as unknown as HealthCheckService;
  }

  it("returns 200 and status UP when everything is healthy", async () => {
    const status = HealthStatus.from(checkedAt, [{ name: "database", state: "UP" }]);
    const controller = new HealthController(serviceReturning(status));
    const res = fakeResponse();

    const body = await controller.check(res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(body.status).toBe("UP");
    expect(body.dependencies).toEqual([{ name: "database", state: "UP" }]);
  });

  it("returns 503 and status DOWN when a dependency is unhealthy", async () => {
    const status = HealthStatus.from(checkedAt, [
      { name: "database", state: "DOWN", detail: "timeout" },
    ]);
    const controller = new HealthController(serviceReturning(status));
    const res = fakeResponse();

    const body = await controller.check(res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(body.status).toBe("DOWN");
  });
});
