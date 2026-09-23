import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrganizationUsersPage from "./page";
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
    principal: { userId: "u1", organizationId: "org-1", role: "ADMIN" },
    accessToken: "tok",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    applySession: vi.fn(),
    ...overrides,
  };
}

const USER = { id: "u2", email: "b@acme.test", role: "VIEWER" };
const PENDING = { id: "inv-1", email: "c@acme.test", role: "VIEWER", acceptedAt: null };
const ACCEPTED = { id: "inv-2", email: "d@acme.test", role: "ADMIN", acceptedAt: "2026-01-01T00:00:00.000Z" };

describe("OrganizationUsersPage", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("lists members and only pending invitations", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockImplementation((path: string) => {
      if (path.endsWith("/users")) return Promise.resolve([USER]);
      return Promise.resolve([PENDING, ACCEPTED]);
    });

    render(<OrganizationUsersPage />);

    expect(await screen.findByText(/b@acme.test/)).toBeInTheDocument();
    expect(await screen.findByText(/c@acme.test/)).toBeInTheDocument();
    expect(screen.queryByText(/d@acme.test/)).not.toBeInTheDocument();
  });

  it("sends an invite and shows the share link", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockImplementation((path: string, opts?: { method?: string }) => {
      if (opts?.method === "POST") {
        return Promise.resolve({ ...PENDING, id: "inv-3", email: "new@acme.test", link: "/accept-invite/raw-token" });
      }
      if (path.endsWith("/users")) return Promise.resolve([USER]);
      return Promise.resolve([PENDING]);
    });

    render(<OrganizationUsersPage />);
    await screen.findByText(/c@acme.test/);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@acme.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await screen.findByText(/accept-invite\/raw-token/)).toBeInTheDocument();
  });

  it("revokes a pending invitation", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    let listCall = 0;
    mockApiFetch.mockImplementation((path: string, opts?: { method?: string }) => {
      if (opts?.method === "DELETE") return Promise.resolve(undefined);
      if (path.endsWith("/users")) return Promise.resolve([USER]);
      listCall += 1;
      return Promise.resolve(listCall === 1 ? [PENDING] : []);
    });

    render(<OrganizationUsersPage />);
    await screen.findByText(/c@acme.test/);

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/organizations/org-1/invitations/inv-1", {
        method: "DELETE",
        accessToken: "tok",
      }),
    );
    await waitFor(() => expect(screen.queryByText(/c@acme.test/)).not.toBeInTheDocument());
  });

  it("shows an error message when the invite fails", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockImplementation((path: string, opts?: { method?: string }) => {
      if (opts?.method === "POST") {
        return Promise.reject(new ApiError(403, "This action requires a different role"));
      }
      if (path.endsWith("/users")) return Promise.resolve([USER]);
      return Promise.resolve([]);
    });

    render(<OrganizationUsersPage />);
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@acme.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This action requires a different role",
    );
  });

  it("never calls the API when there is no organisation on the principal", () => {
    mockUseAuth.mockReturnValue(
      authValue({ principal: { userId: "u1", organizationId: null, role: "ADMIN" } }),
    );

    render(<OrganizationUsersPage />);

    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
