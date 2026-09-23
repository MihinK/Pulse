import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl, Min, MinLength } from "class-validator";
import { Environment } from "../../domain/environment.enum";

export class CreateApplicationDto {
  @ApiProperty({ example: "Payments API" })
  @IsString()
  @MinLength(1)
  public readonly name!: string;

  @ApiProperty({ example: "https://api.acme.test" })
  @IsUrl({ require_tld: false })
  public readonly baseUrl!: string;

  @ApiProperty({ enum: Environment })
  @IsEnum(Environment)
  public readonly environment!: Environment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public readonly description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public readonly tags?: string[];

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly checkIntervalMinutes?: number;

  @ApiPropertyOptional({ default: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly timeoutMs?: number;

  @ApiPropertyOptional({ default: 2000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly slowThresholdMs?: number;
}
