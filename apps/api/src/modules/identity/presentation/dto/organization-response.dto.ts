import { ApiProperty } from "@nestjs/swagger";
import type { Organization } from "../../domain/organization.entity";
import { OrganizationStatus } from "../../domain/organization-status.enum";
import { Edition } from "../../domain/edition.enum";

export class OrganizationResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly name!: string;

  @ApiProperty()
  public readonly slug!: string;

  @ApiProperty({ enum: OrganizationStatus })
  public readonly status!: OrganizationStatus;

  @ApiProperty({ enum: Edition })
  public readonly edition!: Edition;

  @ApiProperty()
  public readonly defaultTimeZone!: string;

  @ApiProperty()
  public readonly createdAt!: string;

  public static fromDomain(organization: Organization): OrganizationResponseDto {
    const dto = new OrganizationResponseDto();
    (dto as { id: string }).id = organization.id;
    (dto as { name: string }).name = organization.name;
    (dto as { slug: string }).slug = organization.slug;
    (dto as { status: OrganizationStatus }).status = organization.status;
    (dto as { edition: Edition }).edition = organization.edition;
    (dto as { defaultTimeZone: string }).defaultTimeZone = organization.defaultTimeZone;
    (dto as { createdAt: string }).createdAt = organization.createdAt.toISOString();
    return dto;
  }
}
