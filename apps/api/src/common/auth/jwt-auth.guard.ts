import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { TOKEN_SERVICE, type TokenService } from "./token-service";
import type { AuthenticatedRequest } from "./authenticated-request";

/**
 * Global guard (registered via `APP_GUARD` in `app.module.ts`): every route requires a valid
 * access token unless marked `@Public()`. Attaches the decoded {@link Principal} to
 * `request.principal`, which {@link RolesGuard} and {@link TenancyInterceptor} both read.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException("Missing access token");
    }

    request.principal = this.tokenService.verifyAccessToken(token);
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  }
}
