import type { EntityRepository } from "@mikro-orm/postgresql";
import { MikroOrmAuthConfigRepository } from "./mikroorm-auth-config.repository";
import { Organization } from "../../identity/domain/organization.entity";
import { Application } from "../domain/application.entity";
import { Environment } from "../domain/environment.enum";
import { AuthConfig } from "../domain/auth-config.entity";
import { AuthType } from "../domain/auth-type.enum";

function build() {
  const persisted: AuthConfig[] = [];
  const flushCount = { value: 0 };
  const em = {
    persist: (config: AuthConfig): void => {
      persisted.push(config);
    },
    flush: async (): Promise<void> => {
      flushCount.value += 1;
    },
  };
  const underlying = {
    findOne: jest.fn(),
    getEntityManager: () => em,
  } as unknown as EntityRepository<AuthConfig>;
  return { repository: new MikroOrmAuthConfigRepository(underlying), underlying, persisted, flushCount };
}

describe("MikroOrmAuthConfigRepository", () => {
  const org = new Organization("Acme", "acme", "UTC");
  const app = new Application(org, "API", "https://api.acme.test", Environment.PROD);
  const config = new AuthConfig(app, AuthType.NONE);

  it("finds by application id", async () => {
    const { repository, underlying } = build();
    (underlying.findOne as jest.Mock).mockResolvedValue(config);

    const result = await repository.findByApplicationId(app.id);

    expect(underlying.findOne).toHaveBeenCalledWith({ application: app.id });
    expect(result).toBe(config);
  });

  it("persists and flushes on save", async () => {
    const { repository, persisted, flushCount } = build();

    await repository.save(config);

    expect(persisted).toEqual([config]);
    expect(flushCount.value).toBe(1);
  });
});
