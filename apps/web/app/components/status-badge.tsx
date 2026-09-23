import type { JSX } from "react";

export type AppStatus = "UP" | "DEGRADED" | "DOWN" | "UNKNOWN";

const LABELS: Record<AppStatus, string> = {
  UP: "Up",
  DEGRADED: "Degraded",
  DOWN: "Down",
  UNKNOWN: "Unknown",
};

const COLORS: Record<AppStatus, string> = {
  UP: "#15803d",
  DEGRADED: "#b45309",
  DOWN: "#b91c1c",
  UNKNOWN: "#6b7280",
};

/**
 * Renders one of the four application/check statuses with a consistent
 * label and color, so the dashboard, application detail page and report
 * page never disagree on how a status looks.
 */
export function StatusBadge({ status }: { status: AppStatus }): JSX.Element {
  return (
    <span role="status" data-status={status} style={{ color: COLORS[status], fontWeight: 600 }}>
      {LABELS[status]}
    </span>
  );
}
