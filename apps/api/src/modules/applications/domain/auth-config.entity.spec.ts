import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "./application.entity";
import { Environment } from "./environment.enum";
import { AuthConfig } from "./auth-config.entity";
import { AuthType } from "./auth-type.enum";

describe("AuthConfig", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

  it("defaults to no encrypted config for NONE", () => {
    const config = new AuthConfig(app, AuthType.NONE);

    expect(config.type).toBe(AuthType.NONE);
    expect(config.configEncrypted).toBeUndefined();
  });

  it("stores the encrypted config for a credentialed type", () => {
    const config = new AuthConfig(app, AuthType.BEARER, Buffer.from("ciphertext"));

    expect(config.type).toBe(AuthType.BEARER);
    expect(config.configEncrypted).toEqual(Buffer.from("ciphertext"));
  });

  it("replace() swaps type and config and clears any cached token", () => {
    const config = new AuthConfig(app, AuthType.BEARER, Buffer.from("old"));
    config.tokenCacheEncrypted = Buffer.from("cached-token");
    config.tokenExpiresAt = new Date();

    config.replace(AuthType.API_KEY, Buffer.from("new"));

    expect(config.type).toBe(AuthType.API_KEY);
    expect(config.configEncrypted).toEqual(Buffer.from("new"));
    expect(config.tokenCacheEncrypted).toBeUndefined();
    expect(config.tokenExpiresAt).toBeUndefined();
  });
});
