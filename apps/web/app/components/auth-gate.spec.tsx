import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthGate } from "./auth-gate";
import { useAuth, type AuthContextValue, type Role } from "../lib/auth-context";

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>("../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const mockUseAuth = vi.mocked(useAuth);

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

describe("AuthGate", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("shows a loading state while the session is being restored", () => {
    mockUseAuth.mockReturnValue(authValue({ loading: true }));

    render(
      <AuthGate>
        <p>secret</p>
      </AuthGate>,
    );

    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no principal", () => {
    mockUseAuth.mockReturnValue(authValue({ principal: null }));

    render(
      <AuthGate>
        <p>secret</p>
      </AuthGate>,
    );

    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("redirects to / when the principal's role is not allowed", () => {
    const role: Role = "VIEWER";
    mockUseAuth.mockReturnValue(
      authValue({ principal: { userId: "u1", organizationId: "o1", role } }),
    );

    render(
      <AuthGate roles={["ADMIN"]}>
        <p>secret</p>
      </AuthGate>,
    );

    expect(replace).toHaveBeenCalledWith("/");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders children for an allowed principal", () => {
    const role: Role = "ADMIN";
    mockUseAuth.mockReturnValue(
      authValue({ principal: { userId: "u1", organizationId: "o1", role } }),
    );

    render(
      <AuthGate roles={["ADMIN"]}>
        <p>secret</p>
      </AuthGate>,
    );

    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders children for any authenticated principal when no roles are given", () => {
    const role: Role = "PLATFORM_OWNER";
    mockUseAuth.mockReturnValue(
      authValue({ principal: { userId: "u1", organizationId: null, role } }),
    );

    render(
      <AuthGate>
        <p>secret</p>
      </AuthGate>,
    );

    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});
