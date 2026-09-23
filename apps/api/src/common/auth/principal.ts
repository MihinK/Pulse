import { Role } from "../../modules/identity/domain/role.enum";

/** Decoded from a verified access token by {@link JwtAuthGuard} and attached to the request. */
export interface Principal {
  readonly userId: string;
  readonly organizationId: string | null;
  readonly role: Role;
}
