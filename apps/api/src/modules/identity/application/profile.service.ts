import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { USER_REPOSITORY } from "../identity.tokens";
import type { UserRepository } from "./ports/user-repository";
import { User } from "../domain/user.entity";

function isValidTimeZone(timeZone: string): boolean {
  try {
    // Constructing it is the validation — Intl.DateTimeFormat throws for an unknown zone.
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class ProfileService {
  public constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  public async getSelf(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  public async updateTimeZone(userId: string, timeZone: string): Promise<User> {
    if (!isValidTimeZone(timeZone)) {
      throw new BadRequestException(`"${timeZone}" is not a recognised IANA time zone`);
    }
    const user = await this.getSelf(userId);
    user.updateTimeZone(timeZone);
    await this.users.save(user);
    return user;
  }

  public async listByOrganization(organizationId: string): Promise<User[]> {
    return this.users.findByOrganization(organizationId);
  }
}
