import type { EntityManager } from "@mikro-orm/postgresql";
import { DatabaseDependencyCheck } from "./database-dependency-check";

function buildFakeEm(execute: () => Promise<unknown>): EntityManager {
  return { getConnection: () => ({ execute }) } as unknown as EntityManager;
}

describe("DatabaseDependencyCheck", () => {
  it("reports UP when the database responds", async () => {
    const check = new DatabaseDependencyCheck(buildFakeEm(() => Promise.resolve([{ "?column?": 1 }])));

    const status = await check.check();

    expect(status).toEqual({ name: "database", state: "UP" });
  });

  it("reports DOWN with the error message when the database is unreachable", async () => {
    const check = new DatabaseDependencyCheck(
      buildFakeEm(() => Promise.reject(new Error("connection refused"))),
    );

    const status = await check.check();

    expect(status).toEqual({ name: "database", state: "DOWN", detail: "connection refused" });
  });

  it("reports DOWN with a generic detail when a non-Error is thrown", async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- deliberately non-Error
    const check = new DatabaseDependencyCheck(buildFakeEm(() => Promise.reject("boom")));

    const status = await check.check();

    expect(status).toEqual({ name: "database", state: "DOWN", detail: "unknown error" });
  });

  it("exposes its name for registration in the dependency check list", () => {
    const check = new DatabaseDependencyCheck(buildFakeEm(() => Promise.resolve()));

    expect(check.name).toBe("database");
  });
});
