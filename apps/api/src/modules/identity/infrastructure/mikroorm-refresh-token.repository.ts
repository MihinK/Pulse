import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import type { EntityRepository } from "@mikro-orm/postgresql";
import { RefreshToken } from "../domain/refresh-token.entity";
import type { RefreshTokenRepository } from "../application/ports/refresh-token-repository";

@Injectable()
export class MikroOrmRefreshTokenRepository implements RefreshTokenRepository {
  public constructor(
    @InjectRepository(RefreshToken) private readonly repo: EntityRepository<RefreshToken>,
  ) {}

  public findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne(
      { tokenHash },
      { populate: ["user", "user.organization", "replacedBy"] },
    );
  }

  public async save(token: RefreshToken): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(token);
    await em.flush();
  }
}
