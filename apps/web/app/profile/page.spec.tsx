import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "./page";
import { useAuth, type AuthContextValue } from "../lib/auth-context";
import { apiFetch, ApiError } from "../lib/api-client";

vi.mock("../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth-context")>("../lib/auth-context");
  return { ...actual, useAuth: vi.fn() };
});

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return { ...actual, apiFetch: vi.fn() };
});

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
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

const USER = { id: "u1", email: "a@acme.test", role: "ADMIN", organizationId: "org-1", timeZone: "UTC" };

describe("ProfilePage", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    replace.mockClear();
  });

  it("loads and displays the caller's profile", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockResolvedValue(USER);

    render(<ProfilePage />);

    expect(await screen.findByText("a@acme.test")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/users/me", { accessToken: "tok" });
  });

  it("always offers UTC as an option even though Intl doesn't list it", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockResolvedValue(USER);

    render(<ProfilePage />);
    await screen.findByText("a@acme.test");

    expect(screen.getByRole("option", { name: "UTC" })).toBeInTheDocument();
  });

  it("saves an updated time zone", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockResolvedValueOnce(USER);
    mockApiFetch.mockResolvedValueOnce({ ...USER, timeZone: "America/New_York" });

    render(<ProfilePage />);
    await screen.findByText("a@acme.test");

    fireEvent.change(screen.getByLabelText("Time zone"), {
      target: { value: "America/New_York" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/users/me", {
        method: "PATCH",
        accessToken: "tok",
        body: { timeZone: "America/New_York" },
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
  });

  it("shows an error message when saving fails", async () => {
    mockUseAuth.mockReturnValue(authValue({}));
    mockApiFetch.mockResolvedValueOnce(USER);
    mockApiFetch.mockRejectedValueOnce(new ApiError(400, "Not a recognised time zone"));

    render(<ProfilePage />);
    await screen.findByText("a@acme.test");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Not a recognised time zone");
  });

  it("never calls the API when there is no access token yet", () => {
    mockUseAuth.mockReturnValue(authValue({ accessToken: null }));

    render(<ProfilePage />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
