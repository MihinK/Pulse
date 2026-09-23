/** Aggregate health, derived from the most recent completed check run (FR-APP-06). */
export enum ApplicationStatus {
  UP = "UP",
  DEGRADED = "DEGRADED",
  DOWN = "DOWN",
  UNKNOWN = "UNKNOWN",
}
