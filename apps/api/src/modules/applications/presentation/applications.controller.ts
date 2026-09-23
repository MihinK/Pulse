import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApplicationService } from "../application/application.service";
import { AuthConfigService } from "../application/auth-config.service";
import { OrganizationService } from "../../identity/application/organization.service";
import { ProfileService } from "../../identity/application/profile.service";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { Roles } from "../../../common/auth/roles.decorator";
import { Role } from "../../identity/domain/role.enum";
import type { Principal } from "../../../common/auth/principal";
import { TenancyInterceptor } from "../../../common/auth/tenancy.interceptor";
import { ApplicationStatus } from "../domain/application-status.enum";
import { Environment } from "../domain/environment.enum";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationDto } from "./dto/update-application.dto";
import { SetAuthConfigDto } from "./dto/set-auth-config.dto";
import { ApplicationResponseDto } from "./dto/application-response.dto";
import { AuthConfigResponseDto } from "./dto/auth-config-response.dto";

@ApiTags("applications")
@Controller("applications")
@UseInterceptors(TenancyInterceptor)
export class ApplicationsController {
  public constructor(
    private readonly applications: ApplicationService,
    private readonly authConfigs: AuthConfigService,
    private readonly organizations: OrganizationService,
    private readonly profile: ProfileService,
  ) {}

  @Roles(Role.ADMIN)
  @Post()
  public async create(
    @CurrentUser() principal: Principal,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const organization = await this.organizations.getById(requireOrganizationId(principal));
    const actor = await this.profile.getSelf(principal.userId);
    const application = await this.applications.create(organization, actor, dto);
    return ApplicationResponseDto.fromDomain(application);
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get()
  public async list(
    @Query("status") status?: ApplicationStatus,
    @Query("environment") environment?: Environment,
    @Query("search") search?: string,
  ): Promise<ApplicationResponseDto[]> {
    const applications = await this.applications.list({ status, environment, search });
    return applications.map((application) => ApplicationResponseDto.fromDomain(application));
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get(":id")
  public async getById(@Param("id") id: string): Promise<ApplicationResponseDto> {
    const application = await this.applications.getById(id);
    return ApplicationResponseDto.fromDomain(application);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  public async update(
    @Param("id") id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applications.update(id, dto);
    return ApplicationResponseDto.fromDomain(application);
  }

  @Roles(Role.ADMIN)
  @Delete(":id")
  @HttpCode(204)
  public async softDelete(@Param("id") id: string): Promise<void> {
    await this.applications.softDelete(id);
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get(":id/auth")
  public async getAuthConfig(@Param("id") id: string): Promise<AuthConfigResponseDto> {
    const summary = await this.authConfigs.get(id);
    return AuthConfigResponseDto.fromSummary(summary);
  }

  @Roles(Role.ADMIN)
  @Put(":id/auth")
  public async setAuthConfig(
    @Param("id") id: string,
    @Body() dto: SetAuthConfigDto,
  ): Promise<AuthConfigResponseDto> {
    const summary = await this.authConfigs.set(id, dto.type, dto.credentials);
    return AuthConfigResponseDto.fromSummary(summary);
  }
}

function requireOrganizationId(principal: Principal): string {
  if (!principal.organizationId) {
    // Unreachable via HTTP: @Roles(Role.ADMIN) already excludes the Platform Owner, the only
    // principal with a null organizationId. Guards against a future @Roles change silently
    // reopening this path.
    throw new ForbiddenException("This action requires an organization");
  }
  return principal.organizationId;
}
