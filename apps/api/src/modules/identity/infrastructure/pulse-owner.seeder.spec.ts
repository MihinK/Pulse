import type { EntityManager } from "@mikro-orm/postgresql";
import { PulseOwnerSeeder } from "./pulse-owner.seeder";
import { User } from "../domain/user.entity";
import { Role } from "../domain/role.enum";
import type { PasswordHasher } from "../application/ports/password-hasher";

class FakePasswordHasher implements PasswordHasher {
  public hash(plainText: string): Promise<string> {
    return Promise.resolve(`hashed:${plainText}`);
  }
  public verify(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

const TRANSACTION_CTX = Symbol("fake-transaction-ctx");

interface FakeEmSetup {
  em: EntityManager;
  executed: Array<{ sql: string; ctx: unknown }>;
  persisted: User[];
}

function buildFakeEm(existingPlatformOwners: number): FakeEmSetup {
  const executed: Array<{ sql: string; ctx: unknown }> = [];
  const persisted: User[] = [];
  const connection = {
    execute: (sql: string, _params: unknown[], _method: string, ctx: unknown): Promise<void> => {
      executed.push({ sql, ctx });
      return Promise.resolve();
    },
  };
  const forkedEm = {
    getConnection: () => connection,
    getTransactionContext: () => TRANSACTION_CTX,
    count: () => Promise.resolve(existingPlatformOwners),
    persist: (user: User): void => {
      persisted.push(user);
    },
  };
  const em = {
    transactional: async (cb: (em: unknown) => Promise<unknown>) => cb(forkedEm),
  } as unknown as EntityManager;
  return { em, executed, persisted };
}

describe("PulseOwnerSeeder", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("does nothing when the env vars are not set", async () => {
    process.env = { ...originalEnv, PLATFORM_OWNER_EMAIL: "", PLATFORM_OWNER_PASSWORD: "" };
    const { em, persisted } = buildFakeEm(0);
    const seeder = new PulseOwnerSeeder(em, new FakePasswordHasher());

    await seeder.onApplicationBootstrap();

    expect(persisted).toHaveLength(0);
  });

  it("creates the Platform Owner when none exists, bypassing RLS for that transaction", async () => {
    process.env = {
      ...originalEnv,
      PLATFORM_OWNER_EMAIL: "owner@pulse.test",
      PLATFORM_OWNER_PASSWORD: "s3cret!",
    };
    const { em, executed, persisted } = buildFakeEm(0);
    const seeder = new PulseOwnerSeeder(em, new FakePasswordHasher());

    await seeder.onApplicationBootstrap();

    expect(executed[0]?.sql).toContain("app.bypass_rls");
    expect(executed[0]?.ctx).toBe(TRANSACTION_CTX);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.email).toBe("owner@pulse.test");
    expect(persisted[0]?.role).toBe(Role.PLATFORM_OWNER);
    expect(persisted[0]?.passwordHash).toBe("hashed:s3cret!");
  });

  it("does not create a second Platform Owner if one already exists", async () => {
    process.env = {
      ...originalEnv,
      PLATFORM_OWNER_EMAIL: "owner@pulse.test",
      PLATFORM_OWNER_PASSWORD: "s3cret!",
    };
    const { em, persisted } = buildFakeEm(1);
    const seeder = new PulseOwnerSeeder(em, new FakePasswordHasher());

    await seeder.onApplicationBootstrap();

    expect(persisted).toHaveLength(0);
  });
});
