import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@acme.test" })
  @IsEmail()
  public readonly email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  public readonly password!: string;
}
