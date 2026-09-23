import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class UpdateProfileDto {
  @ApiProperty({ example: "America/New_York" })
  @IsString()
  @MinLength(1)
  public readonly timeZone!: string;
}
