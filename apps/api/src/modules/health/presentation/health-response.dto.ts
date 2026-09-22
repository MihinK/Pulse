import { ApiProperty } from "@nestjs/swagger";
import { DependencyStatus, HealthStatus } from "../domain/health-status";

class DependencyStatusDto implements DependencyStatus {
  @ApiProperty({ example: "database" })
  public readonly name!: string;

  @ApiProperty({ enum: ["UP", "DOWN"], example: "UP" })
  public readonly state!: "UP" | "DOWN";

  @ApiProperty({ required: false, example: "connection refused" })
  public readonly detail?: string;
}

export class HealthResponseDto {
  @ApiProperty({ enum: ["UP", "DOWN"], example: "UP" })
  public readonly status!: "UP" | "DOWN";

  @ApiProperty({ example: "2026-09-22T10:00:00.000Z" })
  public readonly checkedAt!: string;

  @ApiProperty({ type: [DependencyStatusDto] })
  public readonly dependencies!: DependencyStatusDto[];

  public static fromDomain(health: HealthStatus): HealthResponseDto {
    const dto = new HealthResponseDto();
    (dto as { status: string }).status = health.state;
    (dto as { checkedAt: string }).checkedAt = health.checkedAt.toISOString();
    (dto as { dependencies: DependencyStatus[] }).dependencies = [...health.dependencies];
    return dto;
  }
}
