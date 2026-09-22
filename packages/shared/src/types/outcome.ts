/**
 * The result of a single check (a URL check or one endpoint check).
 * PASSED / FAILED / DEGRADED come from actually calling the target;
 * SKIPPED means Pulse chose not to call it (e.g. a write method without
 * confirmation, or a missing sample value) — this is never counted as
 * a failure of the target.
 */
export enum Outcome {
  PASSED = "PASSED",
  FAILED = "FAILED",
  DEGRADED = "DEGRADED",
  SKIPPED = "SKIPPED",
}

/** Lifecycle of a check run, matching the technical plan's state diagram. */
export enum CheckRunStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
