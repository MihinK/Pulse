import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { EntityManager } from "@mikro-orm/postgresql";
import { lastValueFrom, of } from "rxjs";
import { TenancyInterceptor } from "./tenancy.interceptor";
import type { Principal } from "./principal";
import { Role } from "../../modules/identity/domain/role.enum";

const TRANSACTION_CTX = Symbol("fake-transaction-ctx");

interface FakeEm {
  em: EntityManager;
  calls: Array<{ sql: string; params: unknown[]; method: string; ctx: unknown }>;
}

function buildFakeEm(): FakeEm {
  const calls: Array<{ sql: string; params: unknown[]; method: string; ctx: unknown }> = [];
  const connection = {
    execute: (sql: string, params: unknown[], method: string, ctx: unknown): Promise<void> => {
      calls.push({ sql, params, method, ctx });
      return Promise.resolve();
    },
  };
  const em = {
    getConnection: () => connection,
    getTransactionContext: () => TRANSACTION_CTX,
    transactional: async (cb: (em: unknown) => Promise<unknown>) => cb(em),
  } as unknown as EntityManager;
  return { em, calls };
}

function contextWith(principal: Principal | undefined): ExecutionContext {
  const request = { principal };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const next: CallHandler = { handle: () => of("result") };

describe("TenancyInterceptor", () => {
  it("bypasses RLS and clears the org for an unauthenticated (public) request", async () => {
    const { em, calls } = buildFakeEm();
    const interceptor = new TenancyInterceptor(em);

    const result = await lastValueFrom(interceptor.intercept(contextWith(undefined), next));

    expect(result).toBe("result");
    expect(calls[0]?.params).toEqual(["true"]);
    expect(calls[1]?.params).toEqual([""]);
  });

  it("binds both session-variable calls to the transaction context, not a stray connection", async () => {
    const { em, calls } = buildFakeEm();
    const interceptor = new TenancyInterceptor(em);

    await lastValueFrom(interceptor.intercept(contextWith(undefined), next));

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.ctx).toBe(TRANSACTION_CTX);
    }
  });

  it("scopes to the org and does not bypass for an org Admin", async () => {
    const { em, calls } = buildFakeEm();
    const interceptor = new TenancyInterceptor(em);
    const principal: Principal = { userId: "u1", organizationId: "org-a", role: Role.ADMIN };

    await lastValueFrom(interceptor.intercept(contextWith(principal), next));

    expect(calls[0]?.params).toEqual(["false"]);
    expect(calls[1]?.params).toEqual(["org-a"]);
  });

  it("bypasses RLS for the Platform Owner", async () => {
    const { em, calls } = buildFakeEm();
    const interceptor = new TenancyInterceptor(em);
    const principal: Principal = {
      userId: "u1",
      organizationId: null,
      role: Role.PLATFORM_OWNER,
    };

    await lastValueFrom(interceptor.intercept(contextWith(principal), next));

    expect(calls[0]?.params).toEqual(["true"]);
    expect(calls[1]?.params).toEqual([""]);
  });
});
