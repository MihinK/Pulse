import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Res, UseInterceptors } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { InvitationService } from "../application/invitation.service";
import { Roles } from "../../../common/auth/roles.decorator";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { Public } from "../../../common/auth/public.decorator";
import { Role } from "../domain/role.enum";
import type { Principal } from "../../../common/auth/principal";
import { TenancyInterceptor } from "../../../common/auth/tenancy.interceptor";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { InvitationResponseDto } from "./dto/invitation-response.dto";
import { SessionResponseDto } from "./dto/session-response.dto";
import { setRefreshCookie } from "./refresh-cookie";

@ApiTags("invitations")
@Controller("organizations/:organizationId/invitations")
@UseInterceptors(TenancyInterceptor)
export class InvitationsController {
  public constructor(private readonly invitations: InvitationService) {}

  @Roles(Role.ADMIN, Role.PLATFORM_OWNER)
  @Post()
  public async create(
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() principal: Principal,
  ): Promise<InvitationResponseDto> {
    const { invitation, rawToken } = await this.invitations.create(
      organizationId,
      principal.userId,
      dto.email,
      dto.role,
    );
    return InvitationResponseDto.fromDomain(invitation, `/accept-invite/${rawToken}`);
  }

  @Roles(Role.ADMIN, Role.PLATFORM_OWNER)
  @Get()
  public async list(
    @Param("organizationId") organizationId: string,
  ): Promise<InvitationResponseDto[]> {
    const invitations = await this.invitations.listByOrganization(organizationId);
    return invitations.map((invitation) => InvitationResponseDto.fromDomain(invitation));
  }

  @Roles(Role.ADMIN, Role.PLATFORM_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":id")
  public async revoke(@Param("id") id: string): Promise<void> {
    await this.invitations.revoke(id);
  }
}

/** Separate controller: accepting an invitation is public — the token itself is the credential. */
@ApiTags("invitations")
@Controller("invitations")
@UseInterceptors(TenancyInterceptor)
export class InvitationAcceptController {
  public constructor(private readonly invitations: InvitationService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(":token/accept")
  public async accept(
    @Param("token") token: string,
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    const session = await this.invitations.accept(token, dto.password);
    setRefreshCookie(res, session.refreshToken);
    return SessionResponseDto.fromSession(session);
  }
}
