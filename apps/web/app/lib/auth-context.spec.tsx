import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";

function TestConsumer(): JSX.Element {
  const { principal, accessToken, loading, login, logout, applySession } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="principal">{principal ? principal.role : "none"}</span>
      <span data-testid="token">{accessToken ?? "none"}</span>
      <button onClick={() => void login("a@acme.test", "secret")}>login</button>
      <button onClick={() => void logout()}>logout</button>
      <button
        onClick={() =>
          applySession({
            accessToken: "applied-token",
            userId: "u2",
            organizationId: "org-2",
            role: "VIEWER",
          })
        }
      >
        apply
      </button>
    </div>
  );
}

function mockFetchSequence(responses: Array<{ status: number; body?: unknown }>): void {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      const response = responses[Math.min(call, responses.length - 1)];
      if (!response) {
        throw new Error("mockFetchSequence called with no responses configured");
      }
      call += 1;
      return Promise.resolve({
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        text: () => Promise.resolve(response.body !== undefined ? JSON.stringify(response.body) : ""),
      });
    }),
  );
}

describe("AuthProvider / useAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts loading, then settles unauthenticated when the silent refresh fails", async () => {
    mockFetchSequence([{ status: 401, body: { message: "no cookie" } }]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("principal")).toHaveTextContent("none");
  });

  it("restores a session from a valid refresh cookie on mount", async () => {
    mockFetchSequence([
      { status: 200, body: { accessToken: "t1", userId: "u1", organizationId: "org-1", role: "ADMIN" } },
    ]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("principal")).toHaveTextContent("ADMIN"));
    expect(screen.getByTestId("token")).toHaveTextContent("t1");
  });

  it("login() sets the principal and access token", async () => {
    mockFetchSequence([
      { status: 401 },
      { status: 200, body: { accessToken: "t2", userId: "u1", organizationId: "org-1", role: "ADMIN" } },
    ]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    fireEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("principal")).toHaveTextContent("ADMIN"));
    expect(screen.getByTestId("token")).toHaveTextContent("t2");
  });

  it("logout() clears the principal and access token even if the call fails", async () => {
    mockFetchSequence([
      { status: 200, body: { accessToken: "t1", userId: "u1", organizationId: "org-1", role: "ADMIN" } },
      { status: 500 },
    ]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("principal")).toHaveTextContent("ADMIN"));

    fireEvent.click(screen.getByText("logout"));

    await waitFor(() => expect(screen.getByTestId("principal")).toHaveTextContent("none"));
    expect(screen.getByTestId("token")).toHaveTextContent("none");
  });

  it("applySession() sets the session directly (used by accept-invite)", async () => {
    mockFetchSequence([{ status: 401 }]);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    fireEvent.click(screen.getByText("apply"));

    expect(screen.getByTestId("principal")).toHaveTextContent("VIEWER");
    expect(screen.getByTestId("token")).toHaveTextContent("applied-token");
  });

  it("ignores the silent refresh result if the provider unmounted first", async () => {
    let resolveRefresh: (value: unknown) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      ),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    unmount();

    resolveRefresh({
      status: 200,
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({ accessToken: "t", userId: "u", organizationId: null, role: "VIEWER" }),
        ),
    });
    await Promise.resolve();
    await Promise.resolve();

    // No "state update on an unmounted component" warning — the `cancelled` guard worked.
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("useAuth() throws when used outside an AuthProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<TestConsumer />)).toThrow(
      "useAuth() must be used within an <AuthProvider>",
    );

    consoleError.mockRestore();
  });
});
