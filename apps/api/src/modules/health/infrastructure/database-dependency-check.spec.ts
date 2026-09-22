import { DatabaseDependencyCheck } from "./database-dependency-check";

describe("DatabaseDependencyCheck", () => {
  it("reports UP as a placeholder until the real database check lands in sprint 2", async () => {
    const check = new DatabaseDependencyCheck();

    const status = await check.check();

    expect(status).toEqual({
      name: "database",
      state: "UP",
      detail: "not yet wired (sprint 2)",
    });
  });

  it("exposes its name for registration in the dependency check list", () => {
    const check = new DatabaseDependencyCheck();

    expect(check.name).toBe("database");
  });
});
