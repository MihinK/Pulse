import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "../../../test-support/render-with-providers";
import EditApplicationPage from "./page";
import { useAuth, type AuthContextValue } from "../../../lib/auth-context";
import { getApplication, updateApplication } from "../../../lib/applications-api";

vi.mock("../../../lib/auth-context", async () => {
  const actual =
    await vi.importActual<typeof import("../../../lib/auth-context")>("../../../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../../../lib/applications-api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../lib/applications-api")>("../../../lib/applications-api");
  return { ...actual, getApplication: vi.fn(), updateApplication: vi.fn() };
});

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: pushMock }),
  useParams: () => ({ id: "app-1" }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockGetApplication = vi.mocked(getApplication);
const mockUpdateApplication = vi.mocked(updateApplication);

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

const APP = {
  id: "app-1",
  name: "Payments API",
  baseUrl: "https://api.acme.test",
  environment: "PROD" as const,
  tags: [],
  checkIntervalMinutes: 5,
  timeoutMs: 10000,
  slowThresholdMs: 2000,
  expectedStatuses: null,
  schemaValidation: false,
  status: "UP" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("EditApplicationPage", () => {
  beforeEach(() => {
    mockGetApplication.mockReset();
    mockUpdateApplication.mockReset();
    pushMock.mockReset();
  });

  it("pre-fills the form from the loaded application and saves changes", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockResolvedValue(APP);
    mockUpdateApplication.mockResolvedValue(APP);

    renderWithQueryClient(<EditApplicationPage />);

    expect(await screen.findByLabelText("Name")).toHaveValue("Payments API");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Payments API v2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockUpdateApplication).toHaveBeenCalledWith(
        "tok",
        "app-1",
        expect.objectContaining({ name: "Payments API v2" }),
      ),
    );
    expect(pushMock).toHaveBeenCalledWith("/applications/app-1");
  });

  it("shows an error state when the application fails to load", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockRejectedValue(new Error("not found"));

    renderWithQueryClient(<EditApplicationPage />);

    expect(await screen.findByText("Could not load this application.")).toBeInTheDocument();
  });
});
