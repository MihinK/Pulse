export type HealthState = "UP" | "DOWN";

export interface DependencyStatus {
  readonly name: string;
  readonly state: HealthState;
  readonly detail?: string;
}

/**
 * Overall health of the Pulse API itself, aggregated from the status of
 * each dependency it was asked to check. Immutable value object: nothing
 * outside {@link HealthStatus.from} can construct or mutate one, which is
 * what keeps "how do we decide UP vs DOWN" in exactly one place.
 */
export class HealthStatus {
  private constructor(
    public readonly state: HealthState,
    public readonly checkedAt: Date,
    public readonly dependencies: readonly DependencyStatus[],
  ) {}

  public static from(checkedAt: Date, dependencies: readonly DependencyStatus[]): HealthStatus {
    const state: HealthState = dependencies.every((d) => d.state === "UP") ? "UP" : "DOWN";
    return new HealthStatus(state, checkedAt, dependencies);
  }

  public isUp(): boolean {
    return this.state === "UP";
  }
}
