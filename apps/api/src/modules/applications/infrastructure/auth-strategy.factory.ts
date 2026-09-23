import { Inject, Injectable } from "@nestjs/common";
import type { AuthConfig } from "../domain/auth-config.entity";
import { AuthType } from "../domain/auth-type.enum";
import type { AuthStrategy } from "../application/ports/auth-strategy";
import type { SecretCipher } from "../application/ports/secret-cipher";
import { SECRET_CIPHER } from "../applications.tokens";
import {
  ApiKeyAuthStrategy,
  BasicAuthStrategy,
  BearerAuthStrategy,
  NoAuthStrategy,
} from "./auth-strategies";

interface ApiKeyCredentials {
  location: "header" | "query";
  name: string;
  value: string;
}

interface BearerCredentials {
  token: string;
}

interface BasicCredentials {
  username: string;
  password: string;
}

/**
 * Builds the concrete {@link AuthStrategy} for an application's auth config, decrypting its
 * credentials first. Lives in infrastructure (not the application layer) since it's the one place
 * allowed to know every concrete `AuthStrategy` implementation — the application layer only ever
 * depends on the `AuthStrategy` port.
 */
@Injectable()
export class AuthStrategyFactory {
  public constructor(@Inject(SECRET_CIPHER) private readonly cipher: SecretCipher) {}

  public build(authConfig: AuthConfig | null): AuthStrategy {
    if (!authConfig || authConfig.type === AuthType.NONE) {
      return new NoAuthStrategy();
    }

    switch (authConfig.type) {
      case AuthType.API_KEY: {
        const credentials = this.decrypt<ApiKeyCredentials>(authConfig);
        return new ApiKeyAuthStrategy(credentials.location, credentials.name, credentials.value);
      }
      case AuthType.BEARER: {
        const credentials = this.decrypt<BearerCredentials>(authConfig);
        return new BearerAuthStrategy(credentials.token);
      }
      case AuthType.BASIC: {
        const credentials = this.decrypt<BasicCredentials>(authConfig);
        return new BasicAuthStrategy(credentials.username, credentials.password);
      }
      default:
        // OAUTH2_CC / LOGIN_FLOW: no strategy until sprint 5. AuthConfigService already refuses
        // to persist these types, so this is unreachable via the API — falling back to no-auth
        // rather than throwing keeps a worker from crash-looping on stale data.
        return new NoAuthStrategy();
    }
  }

  private decrypt<T>(authConfig: AuthConfig): T {
    if (!authConfig.configEncrypted) {
      return {} as T;
    }
    return JSON.parse(this.cipher.decrypt(authConfig.configEncrypted)) as T;
  }
}
