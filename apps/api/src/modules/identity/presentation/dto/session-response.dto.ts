import { ApiProperty } from "@nestjs/swagger";
import type { Session } from "../../application/auth.service";
import { Role } from "../../domain/role.enum";

export class SessionResponseDto {
  @ApiProperty()
  public readonly accessToken!: string;

  @ApiProperty()
  public readonly userId!: string;

  @ApiProperty({ nullable: true })
  public readonly organizationId!: string | null;

  @ApiProperty({ enum: Role })
  public readonly role!: Role;

  public static fromSession(session: Session): SessionResponseDto {
    const dto = new SessionResponseDto();
    (dto as { accessToken: string }).accessToken = session.accessToken;
    (dto as { userId: string }).userId = session.principal.userId;
    (dto as { organizationId: string | null }).organizationId = session.principal.organizationId;
    (dto as { role: Role }).role = session.principal.role;
    return dto;
  }
}
