import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AcceptInvitePage from "./page";
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

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useParams: () => ({ token: "raw-token-123" }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockApiFetch = vi.mocked(apiFetch);

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    principal: null,
    accessToken: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    applySession: vi.fn(),
    ...overrides,
  };
}

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    push.mockClear();
    mockApiFetch.mockReset();
  });

  it("accepts the invitation, applies the session, and redirects", async () => {
    const applySession = vi.fn();
    mockUseAuth.mockReturnValue(authValue({ applySession }));
    const session = { accessToken: "tok", userId: "u1", organizationId: "org-1", role: "VIEWER" as const };
    mockApiFetch.mockResolvedValue(session);

    render(<AcceptInvitePage />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith(
      "/invitations/raw-token-123/accept",
      { method: "POST", body: { password: "password123" } },
    ));
    expect(applySession).toHaveBeenCalledWith(session);
    expect(push).toHaveBeenCalledWith("/profile");
  });

  it("shows the server's error message when the invitation is invalid", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockRejectedValue(new ApiError(404, "Invitation not found"));

    render(<AcceptInvitePage />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invitation not found");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic message for a non-API error", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockRejectedValue(new Error("network down"));

    render(<AcceptInvitePage />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This invitation link is invalid or has expired.",
    );
  });
});
