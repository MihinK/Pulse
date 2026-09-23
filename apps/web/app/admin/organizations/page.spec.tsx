import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminOrganizationsPage from "./page";
import { useAuth, type AuthContextValue } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api-client";

vi.mock("../../lib/auth-context", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/auth-context")>("../../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api-client")>("../../lib/api-client");
  return { ...actual, apiFetch: vi.fn() };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockApiFetch = vi.mocked(apiFetch);

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    principal: { userId: "u1", organizationId: null, role: "PLATFORM_OWNER" },
    accessToken: "tok",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    applySession: vi.fn(),
    ...overrides,
  };
}

const ORG = {
  id: "org-1",
  name: "Acme",
  slug: "acme",
  status: "ACTIVE" as const,
  defaultTimeZone: "UTC",
};

describe("AdminOrganizationsPage", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("lists organisations on load", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockResolvedValue([ORG]);

    render(<AdminOrganizationsPage />);

    expect(await screen.findByText("acme")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/organizations", { accessToken: "tok" });
  });

  it("creates an organisation and reloads the list", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockResolvedValueOnce([]); // initial load
    mockApiFetch.mockResolvedValueOnce({ ...ORG }); // create response
    mockApiFetch.mockResolvedValueOnce([ORG]); // reload after create

    render(<AdminOrganizationsPage />);
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Default time zone"), { target: { value: "UTC" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/organizations", {
        method: "POST",
        accessToken: "tok",
        body: { name: "Acme", slug: "acme", defaultTimeZone: "UTC" },
      }),
    );
    expect(await screen.findByText("acme")).toBeInTheDocument();
  });

  it("shows an error when creation fails", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockResolvedValueOnce([]);
    mockApiFetch.mockRejectedValueOnce(new ApiError(409, 'An organisation with slug "acme" already exists'));

    render(<AdminOrganizationsPage />);
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Default time zone"), { target: { value: "UTC" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'An organisation with slug "acme" already exists',
    );
  });

  it("suspends and reactivates an organisation", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockResolvedValueOnce([ORG]); // initial load
    mockApiFetch.mockResolvedValueOnce({ ...ORG, status: "SUSPENDED" }); // patch response
    mockApiFetch.mockResolvedValueOnce([{ ...ORG, status: "SUSPENDED" }]); // reload

    render(<AdminOrganizationsPage />);
    await screen.findByText("acme");

    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/organizations/org-1", {
        method: "PATCH",
        accessToken: "tok",
        body: { active: false },
      }),
    );
    expect(await screen.findByText("SUSPENDED")).toBeInTheDocument();
  });

  it("never calls the API when there is no access token yet", () => {
    mockUseAuth.mockReturnValue(authValue({ accessToken: null }));

    render(<AdminOrganizationsPage />);

    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
