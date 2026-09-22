/**
 * Abstraction over "now". Every part of Pulse that needs the current time
 * depends on this interface rather than calling `new Date()` or `Date.now()`
 * directly, which is what makes date- and duration-based logic deterministic
 * in tests (see {@link FixedClock}).
 */
export interface Clock {
  /** Returns the current instant in UTC. */
  now(): Date;
}
