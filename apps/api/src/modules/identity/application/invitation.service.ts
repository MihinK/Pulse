import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Clock } from "@pulse/shared";
import {
  Invitation,
  InvitationAlreadyAcceptedError,
  InvitationExpiredError,
} from "../domain/invitation.entity";
import { User } from "../domain/user.entity";
import { Role } from "../domain/role.enum";
import { AuthService, hashToken, type Session } from "./auth.service";
import {
  CLOCK,
  INVITATION_REPOSITORY,
  INVITATION_TTL_MS,
  ORGANIZATION_REPOSITORY,
  PASSWORD_HASHER,
  USER_REPOSITORY,
} from "../identity.tokens";
import type { InvitationRepository } from "./ports/invitation-repository";
import type { OrganizationRepository } from "./ports/organization-repository";
import type { UserRepository } from "./ports/user-repository";
import type { PasswordHasher } from "./ports/password-hasher";

/**
 * No email is sent this sprint — `create` returns the raw token for the inviting admin to share
 * directly. Sending it automatically is the `Notifier` interface planned for sprint 7 (technical
 * plan section 4.1).
 *
 * `organizationId`/`invitedById` are resolved here, not passed in as entities, so the RLS
 * isolation guarantee (ADR-003) is what decides whether an org admin can even see the org or
 * inviter row to begin with — an admin from another org gets 404, not a permissions check this
 * service has to remember to run.
 */
@Injectable()
export class InvitationService {
  public constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(INVITATION_TTL_MS) private readonly invitationTtlMs: number,
    private readonly authService: AuthService,
  ) {}

  public async create(
    organizationId: string,
    invitedById: string,
    email: string,
    role: Role,
  ): Promise<{ invitation: Invitation; rawToken: string }> {
    const organization = await this.organizations.findById(organizationId);
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    const invitedBy = await this.users.findById(invitedById);
    if (!invitedBy) {
      throw new NotFoundException("Inviting user not found");
    }

    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(this.clock.now().getTime() + this.invitationTtlMs);
    const invitation = new Invitation(
      organization,
      email,
      role,
      hashToken(rawToken),
      expiresAt,
      invitedBy,
    );
    await this.invitations.save(invitation);
    return { invitation, rawToken };
  }

  public async listByOrganization(organizationId: string): Promise<Invitation[]> {
    return this.invitations.findByOrganization(organizationId);
  }

  public async revoke(invitationId: string): Promise<void> {
    const invitation = await this.invitations.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }
    if (invitation.isAccepted()) {
      throw new BadRequestException("Cannot revoke an invitation that has already been accepted");
    }
    await this.invitations.remove(invitation);
  }

  public async accept(rawToken: string, password: string): Promise<Session> {
    const invitation = await this.invitations.findByTokenHash(hashToken(rawToken));
    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    try {
      invitation.accept(this.clock);
    } catch (error) {
      if (
        error instanceof InvitationAlreadyAcceptedError ||
        error instanceof InvitationExpiredError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const user = new User(invitation.email, passwordHash, invitation.role, invitation.organization);
    await this.users.save(user);
    await this.invitations.save(invitation);

    return this.authService.issueSession(user);
  }
}
