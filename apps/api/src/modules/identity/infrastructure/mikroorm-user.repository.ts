import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import { UniqueConstraintViolationException, type EntityRepository } from "@mikro-orm/postgresql";
import { User } from "../domain/user.entity";
import { Role } from "../domain/role.enum";
import type { UserRepository } from "../application/ports/user-repository";

@Injectable()
export class MikroOrmUserRepository implements UserRepository {
  public constructor(@InjectRepository(User) private readonly repo: EntityRepository<User>) {}

  public findById(id: string): Promise<User | null> {
    return this.repo.findOne({ id }, { populate: ["organization"] });
  }

  public findAllByEmailAcrossOrgs(email: string): Promise<User[]> {
    return this.repo.find({ email }, { populate: ["organization"] });
  }

  public findByOrganization(organizationId: string): Promise<User[]> {
    return this.repo.find({ organization: organizationId });
  }

  public countPlatformOwners(): Promise<number> {
    return this.repo.count({ role: Role.PLATFORM_OWNER });
  }

  public async save(user: User): Promise<void> {
    const em = this.repo.getEntityManager();
    em.persist(user);
    try {
      await em.flush();
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictException(
          "A user with this email already exists in this organisation",
        );
      }
      throw error;
    }
  }
}
