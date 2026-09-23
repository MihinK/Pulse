import type { Invitation } from "../../domain/invitation.entity";

export interface InvitationRepository {
  findById(id: string): Promise<Invitation | null>;
  /** Bypass-scoped: used only by `InvitationService.accept`, before an org is known. */
  findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  findByOrganization(organizationId: string): Promise<Invitation[]>;
  save(invitation: Invitation): Promise<void>;
  remove(invitation: Invitation): Promise<void>;
}
