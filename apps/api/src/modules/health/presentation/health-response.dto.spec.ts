import { HealthStatus } from "../domain/health-status";
import { HealthResponseDto } from "./health-response.dto";

describe("HealthResponseDto.fromDomain", () => {
  it("maps a HealthStatus into the wire shape, with the timestamp as ISO 8601", () => {
    const checkedAt = new Date("2026-09-22T10:00:00.000Z");
    const status = HealthStatus.from(checkedAt, [
      { name: "database", state: "UP" },
      { name: "queue", state: "DOWN", detail: "timeout" },
    ]);

    const dto = HealthResponseDto.fromDomain(status);

    expect(dto.status).toBe("DOWN");
    expect(dto.checkedAt).toBe("2026-09-22T10:00:00.000Z");
    expect(dto.dependencies).toEqual([
      { name: "database", state: "UP" },
      { name: "queue", state: "DOWN", detail: "timeout" },
    ]);
  });

  it("copies the dependency array rather than aliasing the domain object's array", () => {
    const checkedAt = new Date("2026-09-22T10:00:00.000Z");
    const status = HealthStatus.from(checkedAt, [{ name: "database", state: "UP" }]);

    const dto = HealthResponseDto.fromDomain(status);
    dto.dependencies.push({ name: "injected", state: "DOWN" });

    expect(status.dependencies).toHaveLength(1);
  });
});
