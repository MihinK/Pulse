import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { useAuth, type AuthContextValue } from "../lib/auth-context";
import { ApiError } from "../lib/api-client";

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>("../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
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

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
  });

  it("submits email and password to login()", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(authValue({ login }));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@acme.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("a@acme.test", "secret123"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/profile"));
  });

  it("shows the server's error message when login fails", async () => {
    const login = vi.fn().mockRejectedValue(new ApiError(401, "Invalid email or password"));
    mockUseAuth.mockReturnValue(authValue({ login }));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@acme.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic message for a non-API error", async () => {
    const login = vi.fn().mockRejectedValue(new Error("network down"));
    mockUseAuth.mockReturnValue(authValue({ login }));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@acme.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("redirects to /profile if already signed in", () => {
    mockUseAuth.mockReturnValue(
      authValue({ principal: { userId: "u1", organizationId: "o1", role: "ADMIN" } }),
    );

    render(<LoginPage />);

    expect(replace).toHaveBeenCalledWith("/profile");
  });
});
