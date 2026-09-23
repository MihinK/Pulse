import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { TokenService } from "../../../common/auth/token-service";
import type { Principal } from "../../../common/auth/principal";
import { Role } from "../domain/role.enum";

interface AccessTokenClaims {
  sub: string;
  organizationId: string | null;
  role: Role;
}

/** Wraps `@nestjs/jwt`; the module registers it with the secret/TTL from env (see identity.module.ts). */
@Injectable()
export class JwtTokenService implements TokenService {
  public constructor(private readonly jwtService: JwtService) {}

  public signAccessToken(principal: Principal): string {
    const claims: AccessTokenClaims = {
      sub: principal.userId,
      organizationId: principal.organizationId,
      role: principal.role,
    };
    return this.jwtService.sign(claims);
  }

  public verifyAccessToken(token: string): Principal {
    try {
      const claims = this.jwtService.verify<AccessTokenClaims>(token);
      return { userId: claims.sub, organizationId: claims.organizationId, role: claims.role };
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}
