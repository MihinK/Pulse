import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SiteNav } from "./site-nav";
import { useAuth, type AuthContextValue, type Role } from "../lib/auth-context";

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>("../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const mockUseAuth = vi.mocked(useAuth);

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    principal: null,
    accessToken: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    applySession: vi.fn(),
    ...overrides,
  };
}

describe("SiteNav", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("shows a sign-in link while signed out", () => {
    mockUseAuth.mockReturnValue(authValue({}));

    render(<SiteNav />);

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("shows nothing extra while the session is still loading", () => {
    mockUseAuth.mockReturnValue(authValue({ loading: true }));

    render(<SiteNav />);

    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("shows Organisations for the Platform Owner, not People", () => {
    const role: Role = "PLATFORM_OWNER";
    mockUseAuth.mockReturnValue(
      authValue({ principal: { userId: "u1", organizationId: null, role } }),
    );

    render(<SiteNav />);

    expect(screen.getByText("Organisations")).toBeInTheDocument();
    expect(screen.queryByText("People")).not.toBeInTheDocument();
    expect(screen.queryByText("Applications")).not.toBeInTheDocument();
  });

  it("shows People for an org Admin, not Organisations", () => {
    const role: Role = "ADMIN";
    mockUseAuth.mockReturnValue(
      authValue({ principal: { userId: "u1", organizationId: "org-1", role } }),
    );

    render(<SiteNav />);

    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Applications")).toBeInTheDocument();
    expect(screen.queryByText("Organisations")).not.toBeInTheDocument();
  });

  it("signs out and navigates to /login", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const role: Role = "ADMIN";
    mockUseAuth.mockReturnValue(
      authValue({ principal: { userId: "u1", organizationId: "org-1", role }, logout }),
    );

    render(<SiteNav />);
    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/login");
  });
});
