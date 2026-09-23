import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { User } from "../domain/user.entity";
import { Role } from "../domain/role.enum";
import { PASSWORD_HASHER } from "../identity.tokens";
import type { PasswordHasher } from "../application/ports/password-hasher";

/**
 * Creates the first Platform Owner account from `PLATFORM_OWNER_EMAIL` / `PLATFORM_OWNER_PASSWORD`
 * on boot, if none exists yet. Runs outside any HTTP request, so — unlike every other write in
 * this module — it sets the RLS bypass session variable itself, directly on the EntityManager,
 * rather than going through `TenancyInterceptor` (there is no request to intercept).
 */
@Injectable()
export class PulseOwnerSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(PulseOwnerSeeder.name);

  public constructor(
    private readonly em: EntityManager,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    const email = process.env.PLATFORM_OWNER_EMAIL;
    const password = process.env.PLATFORM_OWNER_PASSWORD;
    if (!email || !password) {
      this.logger.warn(
        "PLATFORM_OWNER_EMAIL / PLATFORM_OWNER_PASSWORD not set — skipping Platform Owner bootstrap",
      );
      return;
    }

    await this.em.transactional(async (em) => {
      // See TenancyInterceptor for why the transaction context must be passed explicitly here.
      await em
        .getConnection("write")
        .execute(
          "select set_config('app.bypass_rls', 'true', true)",
          [],
          "all",
          em.getTransactionContext(),
        );
      const existing = await em.count(User, { role: Role.PLATFORM_OWNER });
      if (existing > 0) {
        return;
      }
      const passwordHash = await this.passwordHasher.hash(password);
      const owner = new User(email, passwordHash, Role.PLATFORM_OWNER);
      em.persist(owner);
      this.logger.log(`Seeded Platform Owner account for ${email}`);
    });
  }
}
