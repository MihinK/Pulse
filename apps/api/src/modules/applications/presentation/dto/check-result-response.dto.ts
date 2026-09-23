import { ApiProperty } from "@nestjs/swagger";
import { Outcome } from "@pulse/shared";
import type { CheckResult } from "../../domain/check-result.entity";

export class CheckResultResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly method!: string;

  @ApiProperty()
  public readonly url!: string;

  @ApiProperty({ required: false })
  public readonly statusCode?: number;

  @ApiProperty({ required: false })
  public readonly responseMs?: number;

  @ApiProperty({ enum: Outcome })
  public readonly outcome!: Outcome;

  @ApiProperty({ required: false })
  public readonly failureReason?: string;

  @ApiProperty()
  public readonly checkedAt!: string;

  public static fromDomain(result: CheckResult): CheckResultResponseDto {
    const dto = new CheckResultResponseDto();
    const target = dto as {
      id: string;
      method: string;
      url: string;
      statusCode?: number;
      responseMs?: number;
      outcome: Outcome;
      failureReason?: string;
      checkedAt: string;
    };
    target.id = result.id;
    target.method = result.method;
    target.url = result.url;
    // MikroORM hydrates a NULL column as `null`, not `undefined` — loose `!= null` catches both.
    if (result.statusCode != null) target.statusCode = result.statusCode;
    if (result.responseMs != null) target.responseMs = result.responseMs;
    target.outcome = result.outcome;
    if (result.failureReason != null) target.failureReason = result.failureReason;
    target.checkedAt = result.checkedAt.toISOString();
    return dto;
  }
}
