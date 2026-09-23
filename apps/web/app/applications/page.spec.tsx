import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithQueryClient } from "../test-support/render-with-providers";
import ApplicationsPage from "./page";
import { useAuth, type AuthContextValue } from "../lib/auth-context";
import { listApplications } from "../lib/applications-api";

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>("../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../lib/applications-api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/applications-api")>("../lib/applications-api");
  return { ...actual, listApplications: vi.fn() };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockListApplications = vi.mocked(listApplications);

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    principal: { userId: "u1", organizationId: "org-1", role: "ADMIN" },
    accessToken: "tok",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    applySession: vi.fn(),
    ...overrides,
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

describe("ApplicationsPage", () => {
  beforeEach(() => {
    mockListApplications.mockReset();
  });

  it("lists applications for an authenticated Admin", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListApplications.mockResolvedValue([APP]);

    renderWithQueryClient(<ApplicationsPage />);

    expect(await screen.findByText("Payments API")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add application" })).toBeInTheDocument();
  });

  it("hides the Add application button for a Viewer", async () => {
    mockUseAuth.mockReturnValue(authValue({ principal: { userId: "u1", organizationId: "org-1", role: "VIEWER" } }));
    mockListApplications.mockResolvedValue([APP]);

    renderWithQueryClient(<ApplicationsPage />);

    await screen.findByText("Payments API");
    expect(screen.queryByRole("link", { name: "Add application" })).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no applications", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListApplications.mockResolvedValue([]);

    renderWithQueryClient(<ApplicationsPage />);

    expect(await screen.findByText("No applications yet.")).toBeInTheDocument();
  });

  it("shows an error state when the list fails to load", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListApplications.mockRejectedValue(new Error("boom"));

    renderWithQueryClient(<ApplicationsPage />);

    expect(await screen.findByText("Could not load applications.")).toBeInTheDocument();
  });

  it("re-queries with a search filter once the search box changes", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListApplications.mockResolvedValue([APP]);

    renderWithQueryClient(<ApplicationsPage />);
    await screen.findByText("Payments API");

    fireEvent.change(screen.getByPlaceholderText("Search by name…"), { target: { value: "pay" } });

    await waitFor(() =>
      expect(mockListApplications).toHaveBeenCalledWith(
        "tok",
        expect.objectContaining({ search: "pay" }),
      ),
    );
  });

  it("re-queries with a status filter once a status is picked", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListApplications.mockResolvedValue([APP]);

    renderWithQueryClient(<ApplicationsPage />);
    await screen.findByText("Payments API");

    const [statusTrigger] = screen.getAllByRole("combobox");
    fireEvent.click(statusTrigger as HTMLElement);
    fireEvent.click(await screen.findByRole("option", { name: "UP" }));

    await waitFor(() =>
      expect(mockListApplications).toHaveBeenCalledWith("tok", expect.objectContaining({ status: "UP" })),
    );
  });

  it("never queries the API before an access token is available", async () => {
    mockUseAuth.mockReturnValue(authValue({ accessToken: null }));

    renderWithQueryClient(<ApplicationsPage />);

    await waitFor(() => expect(mockListApplications).not.toHaveBeenCalled());
  });
});
