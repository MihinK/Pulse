import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateOrganizationStatusDto {
  @ApiProperty({ description: "true to activate, false to suspend" })
  @IsBoolean()
  public readonly active!: boolean;
}
