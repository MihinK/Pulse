import { DateTime } from "luxon";

/**
 * The single place that decides how dates, durations and numbers are
 * displayed anywhere in Pulse — the report page, the PDF, the CSV and the
 * dashboard all call this class rather than formatting values themselves.
 * That is what keeps the same run's numbers identical everywhere they
 * appear (see the technical plan, section 7).
 */
export class Formatter {
  /**
   * Formats a UTC instant for display in the given IANA time zone, e.g.
   * "22 Sep 2026, 14:05:33 (Asia/Colombo, UTC+05:30)".
   */
  public dateTime(instant: Date, timeZone: string): string {
    const dt = DateTime.fromJSDate(instant, { zone: "utc" }).setZone(timeZone);
    if (!dt.isValid) {
      throw new Error(`Invalid instant or time zone: ${timeZone}`);
    }
    const datePart = dt.toFormat("dd LLL yyyy, HH:mm:ss");
    const offset = dt.toFormat("ZZ");
    return `${datePart} (${timeZone}, UTC${offset})`;
  }

  /** Formats a UTC instant as ISO 8601 with its offset, for CSV/JSON exports. */
  public isoWithOffset(instant: Date, timeZone: string): string {
    const dt = DateTime.fromJSDate(instant, { zone: "utc" }).setZone(timeZone);
    if (!dt.isValid) {
      throw new Error(`Invalid instant or time zone: ${timeZone}`);
    }
    return dt.toISO({ suppressMilliseconds: false });
  }

  /** Formats a duration in milliseconds as e.g. "1 min 42 s" or "850 ms". */
  public duration(milliseconds: number): string {
    if (milliseconds < 0) {
      throw new Error("Duration cannot be negative");
    }
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)} ms`;
    }
    const totalSeconds = Math.round(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
  }

  /** Formats a whole-number count with thousands separators, e.g. "1,234". */
  public count(value: number): string {
    if (!Number.isFinite(value)) {
      throw new Error("Count must be a finite number");
    }
    return Math.round(value).toLocaleString("en-US");
  }

  /** Formats a ratio (0–1) as a percentage with 2 decimal places, e.g. "97.50%". */
  public percent(ratio: number): string {
    if (!Number.isFinite(ratio)) {
      throw new Error("Percent must be a finite number");
    }
    return `${(ratio * 100).toFixed(2)}%`;
  }

  /**
   * Computes the pass rate as passed / (total - skipped), matching the
   * formula printed on every report footer. Returns null when there is
   * nothing to divide by, so callers can render "n/a" instead of a
   * misleading 0%.
   */
  public passRate(passed: number, total: number, skipped: number): number | null {
    const denominator = total - skipped;
    if (denominator <= 0) {
      return null;
    }
    return passed / denominator;
  }
}
