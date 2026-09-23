import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MinLength } from "class-validator";

export class CreateOrganizationDto {
  @ApiProperty({ example: "Acme Corp" })
  @IsString()
  @MinLength(1)
  public readonly name!: string;

  @ApiProperty({ example: "acme-corp", description: "URL-safe, lowercase, unique" })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: "slug must be lowercase letters, numbers and hyphens only",
  })
  public readonly slug!: string;

  @ApiProperty({ example: "UTC" })
  @IsString()
  @MinLength(1)
  public readonly defaultTimeZone!: string;
}
