import type { User } from "../../domain/user.entity";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /**
   * Bypass-scoped (see `TenancyInterceptor`): used only by `AuthService.login`, before an org is
   * known. May return more than one row — the same email can hold separate accounts in separate
   * organisations (`users` is unique on `(organization, email)`, not on `email` alone).
   */
  findAllByEmailAcrossOrgs(email: string): Promise<User[]>;
  findByOrganization(organizationId: string): Promise<User[]>;
  countPlatformOwners(): Promise<number>;
  save(user: User): Promise<void>;
}
