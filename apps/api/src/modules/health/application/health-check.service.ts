import { Inject, Injectable } from "@nestjs/common";
import { Clock } from "@pulse/shared";
import { HealthStatus } from "../domain/health-status";
import { DependencyCheck } from "./dependency-check";
import { CLOCK, DEPENDENCY_CHECKS } from "../health.tokens";

/**
 * Runs every registered {@link DependencyCheck} and aggregates the result
 * into a single {@link HealthStatus}. Depends only on the `DependencyCheck`
 * interface and the injectable `Clock`, never on a concrete database driver
 * or queue client (Dependency Inversion) — which is what lets this service
 * be unit tested with fakes and no real infrastructure.
 */
@Injectable()
export class HealthCheckService {
  public constructor(
    @Inject(DEPENDENCY_CHECKS) private readonly dependencyChecks: readonly DependencyCheck[],
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async check(): Promise<HealthStatus> {
    const results = await Promise.all(
      this.dependencyChecks.map((dependency) => dependency.check()),
    );
    return HealthStatus.from(this.clock.now(), results);
  }
}
