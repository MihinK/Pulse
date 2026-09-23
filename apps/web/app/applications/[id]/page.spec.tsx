import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "../../test-support/render-with-providers";
import ApplicationDetailPage from "./page";
import { useAuth, type AuthContextValue } from "../../lib/auth-context";
import { getApplication, listRuns, startManualRun } from "../../lib/applications-api";

vi.mock("../../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../../lib/auth-context")>("../../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../../lib/applications-api", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/applications-api")>("../../lib/applications-api");
  return { ...actual, getApplication: vi.fn(), listRuns: vi.fn(), startManualRun: vi.fn() };
});

vi.mock("../../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/documents-api")>("../../lib/documents-api");
  return { ...actual, listDocuments: vi.fn().mockResolvedValue([]) };
});

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: pushMock }),
  useParams: () => ({ id: "app-1" }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockGetApplication = vi.mocked(getApplication);
const mockListRuns = vi.mocked(listRuns);
const mockStartManualRun = vi.mocked(startManualRun);

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
  description: "Handles all payment processing",
  tags: [],
  checkIntervalMinutes: 5,
  timeoutMs: 10000,
  slowThresholdMs: 2000,
  expectedStatuses: null,
  schemaValidation: false,
  status: "UP" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("ApplicationDetailPage", () => {
  beforeEach(() => {
    mockGetApplication.mockReset();
    mockListRuns.mockReset();
    mockStartManualRun.mockReset();
    pushMock.mockReset();
  });

  it("shows application details and its recent runs", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockResolvedValue(APP);
    mockListRuns.mockResolvedValue([
      {
        id: "run-1",
        applicationId: "app-1",
        trigger: "MANUAL",
        status: "COMPLETED",
        total: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        avgMs: 42,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderWithQueryClient(<ApplicationDetailPage />);

    expect(await screen.findByText("Payments API")).toBeInTheDocument();
    expect(screen.getByText("42 ms")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
  });

  it("hides Edit for a Viewer", async () => {
    mockUseAuth.mockReturnValue(authValue({ principal: { userId: "u1", organizationId: "org-1", role: "VIEWER" } }));
    mockGetApplication.mockResolvedValue(APP);
    mockListRuns.mockResolvedValue([]);

    renderWithQueryClient(<ApplicationDetailPage />);

    await screen.findByText("Payments API");
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("triggers a manual run and navigates to the run page", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockResolvedValue(APP);
    mockListRuns.mockResolvedValue([]);
    mockStartManualRun.mockResolvedValue({
      id: "run-2",
      applicationId: "app-1",
      trigger: "MANUAL",
      status: "QUEUED",
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    renderWithQueryClient(<ApplicationDetailPage />);
    await screen.findByText("Payments API");

    fireEvent.click(screen.getByRole("button", { name: "Check now" }));

    await waitFor(() => expect(mockStartManualRun).toHaveBeenCalledWith("tok", "app-1"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/runs/run-2"));
  });

  it("shows an error state when the application fails to load", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockRejectedValue(new Error("not found"));
    mockListRuns.mockResolvedValue([]);

    renderWithQueryClient(<ApplicationDetailPage />);

    expect(await screen.findByText("Could not load this application.")).toBeInTheDocument();
  });
});
