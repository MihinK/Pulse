import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "../../../test-support/render-with-providers";
import EndpointsPage from "./page";
import { useAuth, type AuthContextValue } from "../../../lib/auth-context";
import { getApplication } from "../../../lib/applications-api";
import { listDocuments, listEndpoints, patchEndpoint } from "../../../lib/documents-api";

vi.mock("../../../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/auth-context")>("../../../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../../../lib/applications-api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../lib/applications-api")>("../../../lib/applications-api");
  return { ...actual, getApplication: vi.fn() };
});

vi.mock("../../../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/documents-api")>("../../../lib/documents-api");
  return { ...actual, listDocuments: vi.fn(), listEndpoints: vi.fn(), patchEndpoint: vi.fn() };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useParams: () => ({ id: "app-1" }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockGetApplication = vi.mocked(getApplication);
const mockListDocuments = vi.mocked(listDocuments);
const mockListEndpoints = vi.mocked(listEndpoints);
const mockPatchEndpoint = vi.mocked(patchEndpoint);

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

const ACTIVE_DOCUMENT = {
  id: "doc-1",
  applicationId: "app-1",
  format: "OPENAPI_3" as const,
  specVersion: "3.0.1",
  versionNo: 1,
  isActive: true,
  status: "READY" as const,
  uploadedByUserId: "u1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("EndpointsPage", () => {
  beforeEach(() => {
    mockGetApplication.mockReset();
    mockListDocuments.mockReset();
    mockListEndpoints.mockReset();
    mockPatchEndpoint.mockReset();
  });

  it("shows a message when there's no active document yet", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockResolvedValue(APP);
    mockListDocuments.mockResolvedValue([]);

    renderWithQueryClient(<EndpointsPage />);

    expect(await screen.findByText(/No active API document yet/)).toBeInTheDocument();
  });

  it("groups endpoints by their first path segment", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockResolvedValue(APP);
    mockListDocuments.mockResolvedValue([ACTIVE_DOCUMENT]);
    mockListEndpoints.mockResolvedValue([
      { id: "ep-1", apiDocumentId: "doc-1", method: "GET", path: "/users", included: true, writeEnabled: false, allowInSchedule: false },
      { id: "ep-2", apiDocumentId: "doc-1", method: "POST", path: "/users", included: true, writeEnabled: false, allowInSchedule: false },
      { id: "ep-3", apiDocumentId: "doc-1", method: "GET", path: "/orders/{id}", included: true, writeEnabled: false, allowInSchedule: false },
    ]);

    renderWithQueryClient(<EndpointsPage />);

    expect(await screen.findByText("users")).toBeInTheDocument();
    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(screen.getByText("/orders/{id}")).toBeInTheDocument();
  });

  it("toggles included via a checkbox", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockResolvedValue(APP);
    mockListDocuments.mockResolvedValue([ACTIVE_DOCUMENT]);
    mockListEndpoints.mockResolvedValue([
      { id: "ep-1", apiDocumentId: "doc-1", method: "GET", path: "/users", included: true, writeEnabled: false, allowInSchedule: false },
    ]);
    mockPatchEndpoint.mockResolvedValue({
      id: "ep-1",
      apiDocumentId: "doc-1",
      method: "GET",
      path: "/users",
      included: false,
      writeEnabled: false,
      allowInSchedule: false,
    });

    renderWithQueryClient(<EndpointsPage />);
    await screen.findByText("/users");

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(mockPatchEndpoint).toHaveBeenCalledWith("tok", "ep-1", { included: false }));
  });

  it("saves sample params and body as JSON", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockResolvedValue(APP);
    mockListDocuments.mockResolvedValue([ACTIVE_DOCUMENT]);
    mockListEndpoints.mockResolvedValue([
      { id: "ep-1", apiDocumentId: "doc-1", method: "GET", path: "/users", included: true, writeEnabled: false, allowInSchedule: false },
    ]);
    mockPatchEndpoint.mockResolvedValue({
      id: "ep-1",
      apiDocumentId: "doc-1",
      method: "GET",
      path: "/users",
      included: true,
      writeEnabled: false,
      allowInSchedule: false,
      sampleParams: { id: "1" },
    });

    renderWithQueryClient(<EndpointsPage />);
    await screen.findByText("/users");

    const [paramsBox] = screen.getAllByLabelText("Sample params (JSON)");
    fireEvent.change(paramsBox as HTMLElement, { target: { value: '{"id": "1"}' } });
    fireEvent.click(screen.getByRole("button", { name: "Save sample values" }));

    await waitFor(() =>
      expect(mockPatchEndpoint).toHaveBeenCalledWith("tok", "ep-1", {
        sampleParams: { id: "1" },
        sampleBody: {},
      }),
    );
  });

  it("shows a validation error for invalid JSON instead of saving", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockGetApplication.mockResolvedValue(APP);
    mockListDocuments.mockResolvedValue([ACTIVE_DOCUMENT]);
    mockListEndpoints.mockResolvedValue([
      { id: "ep-1", apiDocumentId: "doc-1", method: "GET", path: "/users", included: true, writeEnabled: false, allowInSchedule: false },
    ]);

    renderWithQueryClient(<EndpointsPage />);
    await screen.findByText("/users");

    const [paramsBox] = screen.getAllByLabelText("Sample params (JSON)");
    fireEvent.change(paramsBox as HTMLElement, { target: { value: "not json" } });
    fireEvent.click(screen.getByRole("button", { name: "Save sample values" }));

    expect(await screen.findByText(/must both be valid JSON/)).toBeInTheDocument();
    expect(mockPatchEndpoint).not.toHaveBeenCalled();
  });

  it("hides write controls for a Viewer", async () => {
    mockUseAuth.mockReturnValue(authValue({ principal: { userId: "u1", organizationId: "org-1", role: "VIEWER" } }));
    mockGetApplication.mockResolvedValue(APP);
    mockListDocuments.mockResolvedValue([ACTIVE_DOCUMENT]);
    mockListEndpoints.mockResolvedValue([
      { id: "ep-1", apiDocumentId: "doc-1", method: "GET", path: "/users", included: true, writeEnabled: false, allowInSchedule: false },
    ]);

    renderWithQueryClient(<EndpointsPage />);
    await screen.findByText("/users");

    expect(screen.queryByLabelText("Sample params (JSON)")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
