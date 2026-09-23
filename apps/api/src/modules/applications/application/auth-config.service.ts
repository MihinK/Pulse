import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuthType } from "../domain/auth-type.enum";
import { APPLICATION_REPOSITORY, AUTH_CONFIG_REPOSITORY, SECRET_CIPHER } from "../applications.tokens";
import type { ApplicationRepository } from "./ports/application-repository";
import type { AuthConfigRepository } from "./ports/auth-config-repository";
import type { SecretCipher } from "./ports/secret-cipher";

/** Types with a working {@link AuthStrategy}; OAUTH2_CC/LOGIN_FLOW are sprint 5. */
const SUPPORTED_TYPES: ReadonlySet<AuthType> = new Set([
  AuthType.NONE,
  AuthType.API_KEY,
  AuthType.BEARER,
  AuthType.BASIC,
]);

/** The auth type currently configured — credentials are never read back (FR-APP-05). */
export interface AuthConfigSummary {
  type: AuthType;
}

@Injectable()
export class AuthConfigService {
  public constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(AUTH_CONFIG_REPOSITORY) private readonly authConfigs: AuthConfigRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
  ) {}

  public async get(applicationId: string): Promise<AuthConfigSummary> {
    const config = await this.findOrThrow(applicationId);
    return { type: config.type };
  }

  public async set(
    applicationId: string,
    type: AuthType,
    credentials?: Record<string, string>,
  ): Promise<AuthConfigSummary> {
    if (!SUPPORTED_TYPES.has(type)) {
      throw new BadRequestException(`Auth type ${type} is not supported yet`);
    }
    const config = await this.findOrThrow(applicationId);
    const encrypted =
      type === AuthType.NONE
        ? undefined
        : this.cipher.encrypt(JSON.stringify(credentials ?? {}));
    config.replace(type, encrypted);
    await this.authConfigs.save(config);
    return { type: config.type };
  }

  private async findOrThrow(applicationId: string) {
    const application = await this.applications.findById(applicationId);
    if (!application || application.isDeleted()) {
      throw new NotFoundException("Application not found");
    }
    const config = await this.authConfigs.findByApplicationId(applicationId);
    if (!config) {
      throw new NotFoundException("Application not found");
    }
    return config;
  }
}
