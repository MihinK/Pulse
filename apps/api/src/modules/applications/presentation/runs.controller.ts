import { Controller, ForbiddenException, Get, Param, Post, UseInterceptors } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApplicationService } from "../application/application.service";
import { RunService } from "../application/run.service";
import { OrganizationService } from "../../identity/application/organization.service";
import { ProfileService } from "../../identity/application/profile.service";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { Roles } from "../../../common/auth/roles.decorator";
import { Role } from "../../identity/domain/role.enum";
import type { Principal } from "../../../common/auth/principal";
import { TenancyInterceptor } from "../../../common/auth/tenancy.interceptor";
import { CheckRunResponseDto } from "./dto/check-run-response.dto";
import { CheckResultResponseDto } from "./dto/check-result-response.dto";

/**
 * Separate from `RunsController` for the same reason `OrganizationUsersController` is separate
 * from `UsersController`: this needs the `applicationId` path param that `/runs/:id` never
 * should.
 */
@ApiTags("runs")
@Controller("applications/:applicationId/runs")
@UseInterceptors(TenancyInterceptor)
export class ApplicationRunsController {
  public constructor(
    private readonly applications: ApplicationService,
    private readonly runs: RunService,
    private readonly organizations: OrganizationService,
    private readonly profile: ProfileService,
  ) {}

  @Roles(Role.ADMIN, Role.VIEWER)
  @Post()
  public async startManualRun(
    @CurrentUser() principal: Principal,
    @Param("applicationId") applicationId: string,
  ): Promise<CheckRunResponseDto> {
    const application = await this.applications.getById(applicationId);
    const organization = await this.organizations.getById(requireOrganizationId(principal));
    const actor = await this.profile.getSelf(principal.userId);
    const run = await this.runs.startManualRun(organization, application, actor);
    return CheckRunResponseDto.fromDomain(run);
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get()
  public async list(@Param("applicationId") applicationId: string): Promise<CheckRunResponseDto[]> {
    await this.applications.getById(applicationId);
    const runs = await this.runs.listForApplication(applicationId);
    return runs.map((run) => CheckRunResponseDto.fromDomain(run));
  }
}

@ApiTags("runs")
@Controller("runs")
@UseInterceptors(TenancyInterceptor)
export class RunsController {
  public constructor(private readonly runs: RunService) {}

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get(":id")
  public async getById(@Param("id") id: string): Promise<CheckRunResponseDto> {
    const run = await this.runs.getRun(id);
    return CheckRunResponseDto.fromDomain(run);
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get(":id/results")
  public async getResults(@Param("id") id: string): Promise<CheckResultResponseDto[]> {
    const results = await this.runs.getResults(id);
    return results.map((result) => CheckResultResponseDto.fromDomain(result));
  }
}

function requireOrganizationId(principal: Principal): string {
  if (!principal.organizationId) {
    throw new ForbiddenException("This action requires an organization");
  }
  return principal.organizationId;
}
