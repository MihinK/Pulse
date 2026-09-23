import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "../../test-support/render-with-providers";
import RunPage from "./page";
import { useAuth, type AuthContextValue } from "../../lib/auth-context";
import { getRun, getRunResults } from "../../lib/applications-api";

vi.mock("../../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../../lib/auth-context")>("../../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../../lib/applications-api", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/applications-api")>("../../lib/applications-api");
  return { ...actual, getRun: vi.fn(), getRunResults: vi.fn() };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useParams: () => ({ id: "run-1" }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockGetRun = vi.mocked(getRun);
const mockGetRunResults = vi.mocked(getRunResults);

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

const BASE_RUN = {
  id: "run-1",
  applicationId: "app-1",
  trigger: "MANUAL" as const,
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("RunPage", () => {
  beforeEach(() => {
    mockGetRun.mockReset();
    mockGetRunResults.mockReset();
  });

  it("shows a waiting message while the run is still in progress, without fetching results", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetRun.mockResolvedValue({ ...BASE_RUN, status: "RUNNING" });

    renderWithQueryClient(<RunPage />);

    expect(await screen.findByText("Waiting for the check to finish…")).toBeInTheDocument();
    expect(mockGetRunResults).not.toHaveBeenCalled();
  });

  it("shows the summary and results once the run has completed", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetRun.mockResolvedValue({
      ...BASE_RUN,
      status: "COMPLETED",
      passed: 1,
      failed: 0,
      avgMs: 42,
      p95Ms: 55,
    });
    mockGetRunResults.mockResolvedValue([
      {
        id: "result-1",
        method: "GET",
        url: "https://api.acme.test",
        statusCode: 200,
        responseMs: 42,
        outcome: "PASSED",
        checkedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderWithQueryClient(<RunPage />);

    expect(await screen.findByText("https://api.acme.test")).toBeInTheDocument();
    expect(screen.getByText("PASSED")).toBeInTheDocument();
    await waitFor(() => expect(mockGetRunResults).toHaveBeenCalledWith("tok", "run-1"));
  });

  it("shows a failure reason alongside a FAILED outcome", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetRun.mockResolvedValue({ ...BASE_RUN, status: "FAILED", failed: 1 });
    mockGetRunResults.mockResolvedValue([
      {
        id: "result-1",
        method: "GET",
        url: "https://api.acme.test",
        outcome: "FAILED",
        failureReason: "connect ECONNREFUSED",
        checkedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderWithQueryClient(<RunPage />);

    expect(await screen.findByText("FAILED — connect ECONNREFUSED")).toBeInTheDocument();
  });

  it("shows an error state when the run fails to load", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetRun.mockRejectedValue(new Error("not found"));

    renderWithQueryClient(<RunPage />);

    expect(await screen.findByText("Could not load this run.")).toBeInTheDocument();
  });
});
