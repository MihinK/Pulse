import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { Invitation } from "../domain/invitation.entity";
import type { InvitationRepository } from "../application/ports/invitation-repository";

@Injectable()
export class MikroOrmInvitationRepository implements InvitationRepository {
  public constructor(
    @InjectRepository(Invitation) private readonly repo: EntityRepository<Invitation>,
  ) {}

  public findById(id: string): Promise<Invitation | null> {
    return this.repo.findOne({ id }, { populate: ["organization", "invitedBy"] });
  }

  public findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return this.repo.findOne({ tokenHash }, { populate: ["organization", "invitedBy"] });
  }

  public findByOrganization(organizationId: string): Promise<Invitation[]> {
    return this.repo.find({ organization: organizationId }, { populate: ["invitedBy"] });
  }

  public async save(invitation: Invitation): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(invitation);
    await em.flush();
  }

  public async remove(invitation: Invitation): Promise<void> {
    await this.repo.getEntityManager().removeAndFlush(invitation);
  }
}
