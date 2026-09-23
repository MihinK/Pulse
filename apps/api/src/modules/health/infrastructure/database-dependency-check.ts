import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { DependencyCheck } from "../application/dependency-check";
import { DependencyStatus } from "../domain/health-status";

/**
 * A lightweight `select 1` against the same connection pool the rest of the API uses. Runs
 * outside any request transaction (this route is `@Public()`, not behind `TenancyInterceptor`),
 * which is fine — it touches no RLS-protected table.
 */
@Injectable()
export class DatabaseDependencyCheck implements DependencyCheck {
  public readonly name = "database";

  public constructor(private readonly em: EntityManager) {}

  public async check(): Promise<DependencyStatus> {
    try {
      await this.em.getConnection().execute("select 1");
      return { name: this.name, state: "UP" };
    } catch (error) {
      return {
        name: this.name,
        state: "DOWN",
        detail: error instanceof Error ? error.message : "unknown error",
      };
    }
  }
}
