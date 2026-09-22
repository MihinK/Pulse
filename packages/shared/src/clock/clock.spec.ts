import { FixedClock } from "./fixed-clock";
import { SystemClock } from "./system-clock";

describe("SystemClock", () => {
  it("returns a Date close to the real current time", () => {
    const before = Date.now();
    const clock = new SystemClock();
    const now = clock.now().getTime();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe("FixedClock", () => {
  it("always returns the instant it was constructed with", () => {
    const startAt = new Date("2026-09-22T10:00:00.000Z");
    const clock = new FixedClock(startAt);

    expect(clock.now()).toEqual(startAt);
    expect(clock.now()).toEqual(startAt);
  });

  it("returns a defensive copy so callers cannot mutate internal state", () => {
    const startAt = new Date("2026-09-22T10:00:00.000Z");
    const clock = new FixedClock(startAt);

    const first = clock.now();
    first.setFullYear(1999);

    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it("advances by the given number of milliseconds", () => {
    const clock = new FixedClock(new Date("2026-09-22T10:00:00.000Z"));

    clock.advanceBy(90_000);

    expect(clock.now()).toEqual(new Date("2026-09-22T10:01:30.000Z"));
  });

  it("can be set to an arbitrary instant", () => {
    const clock = new FixedClock(new Date("2026-09-22T10:00:00.000Z"));

    clock.setTo(new Date("2030-01-01T00:00:00.000Z"));

    expect(clock.now()).toEqual(new Date("2030-01-01T00:00:00.000Z"));
  });
});
