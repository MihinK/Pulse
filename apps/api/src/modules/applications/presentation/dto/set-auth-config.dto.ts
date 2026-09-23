import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional } from "class-validator";
import { AuthType } from "../../domain/auth-type.enum";

export class SetAuthConfigDto {
  @ApiProperty({ enum: AuthType })
  @IsEnum(AuthType)
  public readonly type!: AuthType;

  /**
   * Shape depends on `type` — e.g. `{ location, name, value }` for API_KEY, `{ token }` for
   * BEARER, `{ username, password }` for BASIC. Never echoed back by any read endpoint.
   */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public readonly credentials?: Record<string, string>;
}
