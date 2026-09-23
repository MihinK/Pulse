import { ApiProperty } from "@nestjs/swagger";
import type { Invitation } from "../../domain/invitation.entity";
import { Role } from "../../domain/role.enum";

export class InvitationResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly email!: string;

  @ApiProperty({ enum: Role })
  public readonly role!: Role;

  @ApiProperty()
  public readonly expiresAt!: string;

  @ApiProperty({ nullable: true })
  public readonly acceptedAt!: string | null;

  /** Only present on the create response — never persisted, never returned again. */
  @ApiProperty({ required: false })
  public readonly link?: string;

  public static fromDomain(invitation: Invitation, link?: string): InvitationResponseDto {
    const dto = new InvitationResponseDto();
    (dto as { id: string }).id = invitation.id;
    (dto as { email: string }).email = invitation.email;
    (dto as { role: Role }).role = invitation.role;
    (dto as { expiresAt: string }).expiresAt = invitation.expiresAt.toISOString();
    (dto as { acceptedAt: string | null }).acceptedAt =
      invitation.acceptedAt?.toISOString() ?? null;
    if (link !== undefined) {
      (dto as { link?: string }).link = link;
    }
    return dto;
  }
}
