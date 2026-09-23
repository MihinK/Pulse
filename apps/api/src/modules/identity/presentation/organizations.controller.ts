import { Body, Controller, Get, Param, Patch, Post, UseInterceptors } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrganizationService } from "../application/organization.service";
import { Roles } from "../../../common/auth/roles.decorator";
import { Role } from "../domain/role.enum";
import { TenancyInterceptor } from "../../../common/auth/tenancy.interceptor";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationStatusDto } from "./dto/update-organization-status.dto";
import { OrganizationResponseDto } from "./dto/organization-response.dto";

@ApiTags("organizations")
@Controller("organizations")
@UseInterceptors(TenancyInterceptor)
export class OrganizationsController {
  public constructor(private readonly organizations: OrganizationService) {}

  @Roles(Role.PLATFORM_OWNER)
  @Post()
  public async create(@Body() dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const organization = await this.organizations.create(dto.name, dto.slug, dto.defaultTimeZone);
    return OrganizationResponseDto.fromDomain(organization);
  }

  @Roles(Role.PLATFORM_OWNER)
  @Get()
  public async list(): Promise<OrganizationResponseDto[]> {
    const organizations = await this.organizations.list();
    return organizations.map((organization) => OrganizationResponseDto.fromDomain(organization));
  }

  /**
   * No `@Roles()` — reachable by any authenticated principal, but RLS (ADR-003) means an Admin
   * or Viewer can only ever fetch their own org here; any other id comes back 404, not 403.
   */
  @Get(":id")
  public async getById(@Param("id") id: string): Promise<OrganizationResponseDto> {
    const organization = await this.organizations.getById(id);
    return OrganizationResponseDto.fromDomain(organization);
  }

  @Roles(Role.PLATFORM_OWNER)
  @Patch(":id")
  public async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateOrganizationStatusDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.organizations.setActive(id, dto.active);
    return OrganizationResponseDto.fromDomain(organization);
  }
}
