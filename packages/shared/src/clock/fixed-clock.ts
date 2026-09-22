import { Clock } from "./clock";

/**
 * A clock that always returns a fixed instant, or one that advances only
 * when {@link FixedClock.advanceBy} is called. Used in tests so that
 * durations, timestamps and expiry checks are exact and never flaky.
 */
export class FixedClock implements Clock {
  private current: Date;

  public constructor(startAt: Date) {
    this.current = startAt;
  }

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }

  public setTo(date: Date): void {
    this.current = date;
  }
}
