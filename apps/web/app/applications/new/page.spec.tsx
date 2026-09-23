import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewApplicationPage from "./page";
import { useAuth, type AuthContextValue } from "../../lib/auth-context";
import { createApplication } from "../../lib/applications-api";

vi.mock("../../lib/auth-context", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/auth-context")>("../../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../../lib/applications-api", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/applications-api")>("../../lib/applications-api");
  return { ...actual, createApplication: vi.fn() };
});

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: pushMock }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockCreateApplication = vi.mocked(createApplication);

function authValue(): AuthContextValue {
  return {
    principal: { userId: "u1", organizationId: "org-1", role: "ADMIN" },
    accessToken: "tok",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    applySession: vi.fn(),
  };
}

describe("NewApplicationPage", () => {
  it("creates the application and navigates to its detail page", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockCreateApplication.mockResolvedValue({
      id: "app-1",
      name: "API",
      baseUrl: "https://api.acme.test",
      environment: "PROD",
      tags: [],
      checkIntervalMinutes: 5,
      timeoutMs: 10000,
      slowThresholdMs: 2000,
      expectedStatuses: null,
      schemaValidation: false,
      status: "UNKNOWN",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    render(<NewApplicationPage />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "API" } });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.acme.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create application" }));

    await waitFor(() =>
      expect(mockCreateApplication).toHaveBeenCalledWith(
        "tok",
        expect.objectContaining({ name: "API", baseUrl: "https://api.acme.test" }),
      ),
    );
    expect(pushMock).toHaveBeenCalledWith("/applications/app-1");
  });
});
