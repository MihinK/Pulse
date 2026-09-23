import { SetMetadata, type CustomDecorator } from "@nestjs/common";
import { Role } from "../../modules/identity/domain/role.enum";

export const ROLES_KEY = "roles";

/** Restricts a route to the given roles, enforced by {@link RolesGuard}. */
export const Roles = (...roles: Role[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);
