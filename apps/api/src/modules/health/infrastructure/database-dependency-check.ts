import { Injectable } from "@nestjs/common";
import { DependencyCheck } from "../application/dependency-check";
import { DependencyStatus } from "../domain/health-status";

/**
 * Sprint 1 placeholder: always reports UP, since the database connection
 * itself is not wired up yet (that lands with MikroORM in sprint 2). Kept
 * as its own class, behind the same {@link DependencyCheck} interface the
 * real implementation will use, so `HealthCheckService` and its tests do
 * not change when the real check is dropped in.
 */
@Injectable()
export class DatabaseDependencyCheck implements DependencyCheck {
  public readonly name = "database";

  public async check(): Promise<DependencyStatus> {
    return Promise.resolve({ name: this.name, state: "UP", detail: "not yet wired (sprint 2)" });
  }
}
