import { ApiProperty } from "@nestjs/swagger";
import type { AuthConfigSummary } from "../../application/auth-config.service";
import { AuthType } from "../../domain/auth-type.enum";

/** Never includes credentials (FR-APP-05) — only the configured type. */
export class AuthConfigResponseDto {
  @ApiProperty({ enum: AuthType })
  public readonly type!: AuthType;

  public static fromSummary(summary: AuthConfigSummary): AuthConfigResponseDto {
    const dto = new AuthConfigResponseDto();
    (dto as { type: AuthType }).type = summary.type;
    return dto;
  }
}
