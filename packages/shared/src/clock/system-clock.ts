import { Clock } from "./clock";

/** The real clock. Used everywhere outside of tests. */
export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
