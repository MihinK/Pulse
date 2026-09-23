import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryProvider } from "./query-provider";

describe("QueryProvider", () => {
  it("renders its children", () => {
    render(
      <QueryProvider>
        <p>child content</p>
      </QueryProvider>,
    );

    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
