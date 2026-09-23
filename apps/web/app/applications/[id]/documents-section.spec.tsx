import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "../../test-support/render-with-providers";
import { DocumentsSection } from "./documents-section";
import { useAuth, type AuthContextValue } from "../../lib/auth-context";
import { importDocumentFromUrl, listDocuments, uploadDocumentFile } from "../../lib/documents-api";

vi.mock("../../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../../lib/auth-context")>("../../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../../lib/documents-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/documents-api")>("../../lib/documents-api");
  return { ...actual, listDocuments: vi.fn(), uploadDocumentFile: vi.fn(), importDocumentFromUrl: vi.fn() };
});

const mockUseAuth = vi.mocked(useAuth);
const mockListDocuments = vi.mocked(listDocuments);
const mockUploadDocumentFile = vi.mocked(uploadDocumentFile);
const mockImportDocumentFromUrl = vi.mocked(importDocumentFromUrl);

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

const DOCUMENT = {
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

describe("DocumentsSection", () => {
  beforeEach(() => {
    mockListDocuments.mockReset();
    mockUploadDocumentFile.mockReset();
    mockImportDocumentFromUrl.mockReset();
  });

  it("shows an empty state with no documents", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListDocuments.mockResolvedValue([]);

    renderWithQueryClient(<DocumentsSection applicationId="app-1" />);

    expect(await screen.findByText("No API documents uploaded yet.")).toBeInTheDocument();
  });

  it("lists uploaded versions and links to endpoints once one is active and READY", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListDocuments.mockResolvedValue([DOCUMENT]);

    renderWithQueryClient(<DocumentsSection applicationId="app-1" />);

    expect(await screen.findByText("v1")).toBeInTheDocument();
    expect(screen.getByText("3.0.1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View endpoints" })).toHaveAttribute(
      "href",
      "/applications/app-1/endpoints",
    );
  });

  it("does not link to endpoints when no document is active and READY", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListDocuments.mockResolvedValue([{ ...DOCUMENT, isActive: false }]);

    renderWithQueryClient(<DocumentsSection applicationId="app-1" />);

    await screen.findByText("v1");
    expect(screen.queryByRole("link", { name: "View endpoints" })).not.toBeInTheDocument();
  });

  it("hides the upload/import controls for a Viewer", async () => {
    mockUseAuth.mockReturnValue(authValue({ principal: { userId: "u1", organizationId: "org-1", role: "VIEWER" } }));
    mockListDocuments.mockResolvedValue([]);

    renderWithQueryClient(<DocumentsSection applicationId="app-1" />);

    await screen.findByText("No API documents uploaded yet.");
    expect(screen.queryByLabelText("Upload a spec file")).not.toBeInTheDocument();
  });

  it("uploads a chosen file", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListDocuments.mockResolvedValue([]);
    mockUploadDocumentFile.mockResolvedValue(DOCUMENT);

    renderWithQueryClient(<DocumentsSection applicationId="app-1" />);
    await screen.findByText("No API documents uploaded yet.");

    const file = new File(["openapi: 3.0.0"], "spec.yaml", { type: "text/yaml" });
    const input = screen.getByLabelText("Upload a spec file");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadDocumentFile).toHaveBeenCalledWith("tok", "app-1", file));
  });

  it("imports from a URL", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListDocuments.mockResolvedValue([]);
    mockImportDocumentFromUrl.mockResolvedValue(DOCUMENT);

    renderWithQueryClient(<DocumentsSection applicationId="app-1" />);
    await screen.findByText("No API documents uploaded yet.");

    fireEvent.change(screen.getByLabelText("Or import from a URL"), {
      target: { value: "https://api.acme.test/openapi.json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() =>
      expect(mockImportDocumentFromUrl).toHaveBeenCalledWith("tok", "app-1", "https://api.acme.test/openapi.json"),
    );
  });

  it("shows an error message when the upload fails", async () => {
    mockUseAuth.mockReturnValue(authValue());
    mockListDocuments.mockResolvedValue([]);
    const { ApiError } = await import("../../lib/api-client");
    mockUploadDocumentFile.mockRejectedValue(new ApiError(400, "Unrecognized spec format"));

    renderWithQueryClient(<DocumentsSection applicationId="app-1" />);
    await screen.findByText("No API documents uploaded yet.");

    const file = new File(["garbage"], "spec.yaml");
    fireEvent.change(screen.getByLabelText("Upload a spec file"), { target: { files: [file] } });

    expect(await screen.findByText("Unrecognized spec format")).toBeInTheDocument();
  });
});
