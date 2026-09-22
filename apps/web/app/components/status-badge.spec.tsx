import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it.each([
    ["UP", "Up"],
    ["DEGRADED", "Degraded"],
    ["DOWN", "Down"],
    ["UNKNOWN", "Unknown"],
  ] as const)("renders the label for status %s", (status, expectedLabel) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByRole("status")).toHaveTextContent(expectedLabel);
  });

  it("exposes the raw status as a data attribute for styling and tests", () => {
    render(<StatusBadge status="DOWN" />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "DOWN");
  });
});
