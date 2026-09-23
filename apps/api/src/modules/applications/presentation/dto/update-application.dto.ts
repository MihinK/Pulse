import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from "class-validator";
import { Environment } from "../../domain/environment.enum";

export class UpdateApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  public readonly name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  public readonly baseUrl?: string;

  @ApiPropertyOptional({ enum: Environment })
  @IsOptional()
  @IsEnum(Environment)
  public readonly environment?: Environment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public readonly description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public readonly tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly checkIntervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly timeoutMs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly slowThresholdMs?: number;

  @ApiPropertyOptional({ type: [Number], nullable: true })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  public readonly expectedStatuses?: number[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public readonly schemaValidation?: boolean;
}
