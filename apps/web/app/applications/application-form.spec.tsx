import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApplicationForm } from "./application-form";
import { ApiError } from "../lib/api-client";

describe("ApplicationForm", () => {
  it("submits the entered values, defaulting an empty description to undefined", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ApplicationForm submitLabel="Create" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "API" } });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.acme.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "API",
        baseUrl: "https://api.acme.test",
        environment: "PROD",
        description: undefined,
        checkIntervalMinutes: 5,
        timeoutMs: 10_000,
        slowThresholdMs: 2000,
      }),
    );
  });

  it("submits every field's edited value", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ApplicationForm submitLabel="Create" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "API" } });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.acme.test" },
    });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "desc" } });
    fireEvent.change(screen.getByLabelText("Check interval (minutes)"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Timeout (ms)"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("Slow threshold (ms)"), { target: { value: "500" } });

    const [environmentTrigger] = screen.getAllByRole("combobox");
    fireEvent.click(environmentTrigger as HTMLElement);
    fireEvent.click(await screen.findByRole("option", { name: "DEV" }));

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "API",
        baseUrl: "https://api.acme.test",
        environment: "DEV",
        description: "desc",
        checkIntervalMinutes: 15,
        timeoutMs: 3000,
        slowThresholdMs: 500,
      }),
    );
  });

  it("pre-fills from initialValues", () => {
    render(
      <ApplicationForm
        submitLabel="Save"
        initialValues={{ name: "Existing", baseUrl: "https://existing.test", environment: "DEV" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Existing");
    expect(screen.getByLabelText("Base URL")).toHaveValue("https://existing.test");
  });

  it("shows the server error message on failure", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, "Name already in use"));
    render(<ApplicationForm submitLabel="Create" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "API" } });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.acme.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Name already in use");
  });

  it("shows a generic error message for a non-ApiError failure", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network down"));
    render(<ApplicationForm submitLabel="Create" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "API" } });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.acme.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
