import { DependencyStatus } from "../domain/health-status";

/**
 * One thing Pulse's own health check depends on (its database, its queue,
 * ...). Each dependency gets its own implementation of this interface, so
 * adding a new dependency to check never means editing
 * {@link HealthCheckService} (Open/Closed).
 */
export interface DependencyCheck {
  readonly name: string;
  check(): Promise<DependencyStatus>;
}
