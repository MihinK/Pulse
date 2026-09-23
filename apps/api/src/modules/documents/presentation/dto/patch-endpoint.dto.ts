import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional } from "class-validator";

export class PatchEndpointDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public readonly included?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public readonly sampleParams?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  public readonly sampleBody?: Record<string, unknown>;
}
