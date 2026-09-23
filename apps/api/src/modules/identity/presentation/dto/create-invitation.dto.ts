import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn } from "class-validator";
import { Role } from "../../domain/role.enum";

/** Platform Owner cannot be invited — it is seeded from environment variables, never invited. */
const INVITABLE_ROLES = [Role.ADMIN, Role.VIEWER] as const;

export class CreateInvitationDto {
  @ApiProperty({ example: "new-user@acme.test" })
  @IsEmail()
  public readonly email!: string;

  @ApiProperty({ enum: INVITABLE_ROLES })
  @IsIn(INVITABLE_ROLES)
  public readonly role!: Role;
}
