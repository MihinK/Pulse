import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class AcceptInvitationDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  public readonly password!: string;
}
