import { ApiProperty } from "@nestjs/swagger";
import { CheckRunStatus } from "@pulse/shared";
import type { CheckRun } from "../../domain/check-run.entity";
import { CheckTrigger } from "../../domain/check-trigger.enum";

export class CheckRunResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly applicationId!: string;

  @ApiProperty({ enum: CheckTrigger })
  public readonly trigger!: CheckTrigger;

  @ApiProperty({ enum: CheckRunStatus })
  public readonly status!: CheckRunStatus;

  @ApiProperty()
  public readonly total!: number;

  @ApiProperty()
  public readonly passed!: number;

  @ApiProperty()
  public readonly failed!: number;

  @ApiProperty()
  public readonly skipped!: number;

  @ApiProperty({ required: false })
  public readonly avgMs?: number;

  @ApiProperty({ required: false })
  public readonly p95Ms?: number;

  @ApiProperty()
  public readonly createdAt!: string;

  @ApiProperty({ required: false })
  public readonly startedAt?: string;

  @ApiProperty({ required: false })
  public readonly finishedAt?: string;

  public static fromDomain(run: CheckRun): CheckRunResponseDto {
    const dto = new CheckRunResponseDto();
    const target = dto as {
      id: string;
      applicationId: string;
      trigger: CheckTrigger;
      status: CheckRunStatus;
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      avgMs?: number;
      p95Ms?: number;
      createdAt: string;
      startedAt?: string;
      finishedAt?: string;
    };
    target.id = run.id;
    target.applicationId = run.application.id;
    target.trigger = run.trigger;
    target.status = run.status;
    target.total = run.total;
    target.passed = run.passed;
    target.failed = run.failed;
    target.skipped = run.skipped;
    // MikroORM hydrates a NULL column as `null`, not `undefined` — loose `!= null` catches both.
    if (run.avgMs != null) target.avgMs = run.avgMs;
    if (run.p95Ms != null) target.p95Ms = run.p95Ms;
    target.createdAt = run.createdAt.toISOString();
    if (run.startedAt != null) target.startedAt = run.startedAt.toISOString();
    if (run.finishedAt != null) target.finishedAt = run.finishedAt.toISOString();
    return dto;
  }
}
