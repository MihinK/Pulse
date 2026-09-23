import { Body, Controller, Get, Param, Patch, UseInterceptors } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProfileService } from "../application/profile.service";
import { OrganizationService } from "../application/organization.service";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { Roles } from "../../../common/auth/roles.decorator";
import { Role } from "../domain/role.enum";
import type { Principal } from "../../../common/auth/principal";
import { TenancyInterceptor } from "../../../common/auth/tenancy.interceptor";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserResponseDto } from "./dto/user-response.dto";

@ApiTags("users")
@Controller()
@UseInterceptors(TenancyInterceptor)
export class UsersController {
  public constructor(private readonly profile: ProfileService) {}

  @Get("users/me")
  public async getSelf(@CurrentUser() principal: Principal): Promise<UserResponseDto> {
    const user = await this.profile.getSelf(principal.userId);
    return UserResponseDto.fromDomain(user);
  }

  @Patch("users/me")
  public async updateSelf(
    @CurrentUser() principal: Principal,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.profile.updateTimeZone(principal.userId, dto.timeZone);
    return UserResponseDto.fromDomain(user);
  }
}

/**
 * Separate from `UsersController`: `/organizations/:organizationId/users` needs the org path
 * param, which `/users/me` never should — folding both into one controller would let the two
 * accidentally share a `@Controller()` prefix and match the wrong route.
 */
@ApiTags("users")
@Controller("organizations/:organizationId/users")
@UseInterceptors(TenancyInterceptor)
export class OrganizationUsersController {
  public constructor(
    private readonly profile: ProfileService,
    private readonly organizations: OrganizationService,
  ) {}

  @Roles(Role.ADMIN, Role.PLATFORM_OWNER)
  @Get()
  public async listByOrganization(
    @Param("organizationId") organizationId: string,
  ): Promise<UserResponseDto[]> {
    // Without this, an org this principal can't see (RLS) would come back 200 + [] instead of
    // 404 — technically no data leaks either way, but it's an inconsistent signal next to
    // GET /organizations/:id, and 404 is the safer default (no oracle for "does this id exist").
    await this.organizations.getById(organizationId);
    const users = await this.profile.listByOrganization(organizationId);
    return users.map((user) => UserResponseDto.fromDomain(user));
  }
}
