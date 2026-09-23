import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";
import { Role } from "../../modules/identity/domain/role.enum";
import type { AuthenticatedRequest } from "./authenticated-request";

/**
 * Global guard: no-ops unless a handler carries `@Roles(...)` metadata, in which case it checks
 * `request.principal.role` (set by {@link JwtAuthGuard}, which always runs first). A route with
 * no `@Roles()` is reachable by anyone authenticated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.principal?.role;

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException("This action requires a different role");
    }
    return true;
  }
}
