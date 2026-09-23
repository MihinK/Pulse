import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AuthConfigService } from "./auth-config.service";
import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { AuthConfig } from "../domain/auth-config.entity";
import { AuthType } from "../domain/auth-type.enum";
import type { ApplicationRepository } from "./ports/application-repository";
import type { AuthConfigRepository } from "./ports/auth-config-repository";
import type { SecretCipher } from "./ports/secret-cipher";

describe("AuthConfigService", () => {
  const org = new Organization("Acme", "acme", "UTC");

  function build() {
    const applications: jest.Mocked<ApplicationRepository> = {
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    };
    const authConfigs: jest.Mocked<AuthConfigRepository> = {
      findByApplicationId: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const cipher: jest.Mocked<SecretCipher> = {
      encrypt: jest.fn().mockReturnValue(Buffer.from("ciphertext")),
      decrypt: jest.fn(),
    };
    const service = new AuthConfigService(applications, authConfigs, cipher);
    return { service, applications, authConfigs, cipher };
  }

  it("get returns only the type", async () => {
    const { service, applications, authConfigs } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    applications.findById.mockResolvedValue(app);
    authConfigs.findByApplicationId.mockResolvedValue(new AuthConfig(app, AuthType.BEARER));

    const summary = await service.get(app.id);

    expect(summary).toEqual({ type: AuthType.BEARER });
  });

  it("get 404s when the application does not exist", async () => {
    const { service, applications } = build();
    applications.findById.mockResolvedValue(null);

    await expect(service.get("missing")).rejects.toThrow(NotFoundException);
  });

  it("get 404s when the application exists but has no auth config", async () => {
    const { service, applications, authConfigs } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    applications.findById.mockResolvedValue(app);
    authConfigs.findByApplicationId.mockResolvedValue(null);

    await expect(service.get(app.id)).rejects.toThrow(NotFoundException);
  });

  it("set refuses unsupported auth types", async () => {
    const { service, applications, authConfigs } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    applications.findById.mockResolvedValue(app);
    authConfigs.findByApplicationId.mockResolvedValue(new AuthConfig(app, AuthType.NONE));

    await expect(service.set(app.id, AuthType.OAUTH2_CC)).rejects.toThrow(BadRequestException);
  });

  it("set encrypts credentials for a credentialed type", async () => {
    const { service, applications, authConfigs, cipher } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    applications.findById.mockResolvedValue(app);
    const config = new AuthConfig(app, AuthType.NONE);
    authConfigs.findByApplicationId.mockResolvedValue(config);

    const summary = await service.set(app.id, AuthType.BEARER, { token: "secret" });

    expect(cipher.encrypt).toHaveBeenCalledWith(JSON.stringify({ token: "secret" }));
    expect(config.configEncrypted).toEqual(Buffer.from("ciphertext"));
    expect(authConfigs.save).toHaveBeenCalledWith(config);
    expect(summary).toEqual({ type: AuthType.BEARER });
  });

  it("set clears the encrypted config for NONE", async () => {
    const { service, applications, authConfigs, cipher } = build();
    const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
    applications.findById.mockResolvedValue(app);
    const config = new AuthConfig(app, AuthType.BEARER, Buffer.from("old"));
    authConfigs.findByApplicationId.mockResolvedValue(config);

    await service.set(app.id, AuthType.NONE);

    expect(cipher.encrypt).not.toHaveBeenCalled();
    expect(config.configEncrypted).toBeUndefined();
  });
});
