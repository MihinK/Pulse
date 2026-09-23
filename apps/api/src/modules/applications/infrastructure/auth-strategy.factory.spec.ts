import { AuthStrategyFactory } from "./auth-strategy.factory";
import { ApiKeyAuthStrategy, BasicAuthStrategy, BearerAuthStrategy, NoAuthStrategy } from "./auth-strategies";
import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { AuthConfig } from "../domain/auth-config.entity";
import { AuthType } from "../domain/auth-type.enum";
import type { SecretCipher } from "../application/ports/secret-cipher";

describe("AuthStrategyFactory", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);

  function build(decryptedJson: string) {
    const cipher: jest.Mocked<SecretCipher> = {
      encrypt: jest.fn(),
      decrypt: jest.fn().mockReturnValue(decryptedJson),
    };
    return { factory: new AuthStrategyFactory(cipher), cipher };
  }

  it("returns NoAuthStrategy when there is no auth config", () => {
    const { factory } = build("{}");

    expect(factory.build(null)).toBeInstanceOf(NoAuthStrategy);
  });

  it("returns NoAuthStrategy for type NONE without decrypting anything", () => {
    const { factory, cipher } = build("{}");
    const config = new AuthConfig(app, AuthType.NONE);

    expect(factory.build(config)).toBeInstanceOf(NoAuthStrategy);
    expect(cipher.decrypt).not.toHaveBeenCalled();
  });

  it("builds an ApiKeyAuthStrategy from decrypted credentials", () => {
    const { factory } = build(JSON.stringify({ location: "header", name: "x-api-key", value: "secret" }));
    const config = new AuthConfig(app, AuthType.API_KEY, Buffer.from("ciphertext"));

    const strategy = factory.build(config);

    expect(strategy).toBeInstanceOf(ApiKeyAuthStrategy);
    expect(strategy.apply({ url: app.baseUrl, headers: {} }).headers).toEqual({ "x-api-key": "secret" });
  });

  it("builds a BearerAuthStrategy from decrypted credentials", () => {
    const { factory } = build(JSON.stringify({ token: "my-token" }));
    const config = new AuthConfig(app, AuthType.BEARER, Buffer.from("ciphertext"));

    const strategy = factory.build(config);

    expect(strategy).toBeInstanceOf(BearerAuthStrategy);
  });

  it("builds a BasicAuthStrategy from decrypted credentials", () => {
    const { factory } = build(JSON.stringify({ username: "u", password: "p" }));
    const config = new AuthConfig(app, AuthType.BASIC, Buffer.from("ciphertext"));

    const strategy = factory.build(config);

    expect(strategy).toBeInstanceOf(BasicAuthStrategy);
  });

  it("falls back to NoAuthStrategy for an unsupported type", () => {
    const { factory } = build("{}");
    const config = new AuthConfig(app, AuthType.OAUTH2_CC);

    expect(factory.build(config)).toBeInstanceOf(NoAuthStrategy);
  });

  it("treats a missing encrypted config as empty credentials", () => {
    const { factory, cipher } = build("{}");
    const config = new AuthConfig(app, AuthType.BEARER);

    factory.build(config);

    expect(cipher.decrypt).not.toHaveBeenCalled();
  });
});
