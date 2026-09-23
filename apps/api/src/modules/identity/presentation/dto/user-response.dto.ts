import { ApiProperty } from "@nestjs/swagger";
import type { User } from "../../domain/user.entity";
import { Role } from "../../domain/role.enum";

export class UserResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly email!: string;

  @ApiProperty({ enum: Role })
  public readonly role!: Role;

  @ApiProperty({ nullable: true })
  public readonly organizationId!: string | null;

  @ApiProperty()
  public readonly timeZone!: string;

  public static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    (dto as { id: string }).id = user.id;
    (dto as { email: string }).email = user.email;
    (dto as { role: Role }).role = user.role;
    (dto as { organizationId: string | null }).organizationId = user.organizationId() ?? null;
    (dto as { timeZone: string }).timeZone = user.timeZone;
    return dto;
  }
}
