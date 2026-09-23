import type { AuthConfig } from "../../domain/auth-config.entity";

export interface AuthConfigRepository {
  findByApplicationId(applicationId: string): Promise<AuthConfig | null>;
  save(authConfig: AuthConfig): Promise<void>;
}
