import { Formatter } from "./formatter";

describe("Formatter", () => {
  const formatter = new Formatter();
  const instant = new Date("2026-09-22T08:35:33.000Z"); // 14:05:33 in Asia/Colombo (UTC+05:30)

  describe("dateTime", () => {
    it("formats an instant in the given time zone with the UTC offset shown", () => {
      expect(formatter.dateTime(instant, "Asia/Colombo")).toBe(
        "22 Sep 2026, 14:05:33 (Asia/Colombo, UTC+05:30)",
      );
    });

    it("formats the same instant differently in a different time zone", () => {
      expect(formatter.dateTime(instant, "UTC")).toBe("22 Sep 2026, 08:35:33 (UTC, UTC+00:00)");
    });

    it("throws for an invalid time zone", () => {
      expect(() => formatter.dateTime(instant, "Not/AZone")).toThrow();
    });
  });

  describe("isoWithOffset", () => {
    it("returns ISO 8601 with the zone's offset", () => {
      expect(formatter.isoWithOffset(instant, "Asia/Colombo")).toBe(
        "2026-09-22T14:05:33.000+05:30",
      );
    });

    it("throws for an invalid time zone", () => {
      expect(() => formatter.isoWithOffset(instant, "Not/AZone")).toThrow();
    });
  });

  describe("duration", () => {
    it("shows sub-second durations in milliseconds", () => {
      expect(formatter.duration(850)).toBe("850 ms");
    });

    it("shows durations under a minute in seconds", () => {
      expect(formatter.duration(45_000)).toBe("45 s");
    });

    it("shows durations over a minute as minutes and seconds", () => {
      expect(formatter.duration(102_000)).toBe("1 min 42 s");
    });

    it("rejects negative durations", () => {
      expect(() => formatter.duration(-1)).toThrow();
    });
  });

  describe("count", () => {
    it("adds thousands separators", () => {
      expect(formatter.count(1234)).toBe("1,234");
      expect(formatter.count(42)).toBe("42");
      expect(formatter.count(1_000_000)).toBe("1,000,000");
    });

    it("rejects non-finite values", () => {
      expect(() => formatter.count(Number.NaN)).toThrow();
    });
  });

  describe("percent", () => {
    it("formats a ratio to 2 decimal places", () => {
      expect(formatter.percent(0.975)).toBe("97.50%");
      expect(formatter.percent(1)).toBe("100.00%");
      expect(formatter.percent(0)).toBe("0.00%");
    });

    it("rejects non-finite ratios", () => {
      expect(() => formatter.percent(Number.NaN)).toThrow();
    });
  });

  describe("passRate", () => {
    it("divides passed by total minus skipped", () => {
      expect(formatter.passRate(39, 40, 0)).toBeCloseTo(0.975);
    });

    it("excludes skipped checks from the denominator", () => {
      // 39 passed out of 40 total, 2 skipped -> denominator is 38
      expect(formatter.passRate(37, 40, 2)).toBeCloseTo(37 / 38);
    });

    it("returns null when nothing ran, instead of dividing by zero", () => {
      expect(formatter.passRate(0, 0, 0)).toBeNull();
    });

    it("returns null when every check was skipped", () => {
      expect(formatter.passRate(0, 5, 5)).toBeNull();
    });
  });
});
