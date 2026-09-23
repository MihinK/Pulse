import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Principal } from "./principal";
import type { AuthenticatedRequest } from "./authenticated-request";

/** Exported separately so it can be unit tested without going through Nest's DI machinery. */
export function extractCurrentUser(_data: unknown, ctx: ExecutionContext): Principal {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.principal) {
    throw new Error("@CurrentUser() used on a route with no authenticated principal");
  }
  return request.principal;
}

/** Injects the authenticated {@link Principal}. Only valid on routes behind `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator(extractCurrentUser);
