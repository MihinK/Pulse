import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./api-client";

function mockFetchOnce(response: {
  status: number;
  body?: unknown;
  bodyText?: string;
}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    text: () =>
      Promise.resolve(
        response.bodyText ?? (response.body !== undefined ? JSON.stringify(response.body) : ""),
      ),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on success", async () => {
    mockFetchOnce({ status: 200, body: { id: "1" } });

    const result = await apiFetch<{ id: string }>("/things");

    expect(result).toEqual({ id: "1" });
  });

  it("sends credentials, method, and JSON body", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: { ok: true } });

    await apiFetch("/things", { method: "POST", body: { a: 1 } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/things"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ a: 1 }),
      }),
    );
  });

  it("omits the body key entirely when there is no body", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: {} });

    await apiFetch("/things");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect("body" in init).toBe(false);
  });

  it("attaches an Authorization header when an access token is given", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: {} });

    await apiFetch("/things", { accessToken: "tok-123" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("returns undefined for a 204 response without reading a body", async () => {
    mockFetchOnce({ status: 204 });

    const result = await apiFetch<void>("/things", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  it("throws ApiError with the server's message on failure", async () => {
    mockFetchOnce({ status: 404, body: { message: "Not found" } });

    await expect(apiFetch("/things/missing")).rejects.toMatchObject(
      new ApiError(404, "Not found"),
    );
  });

  it("joins an array of validation messages", async () => {
    mockFetchOnce({ status: 400, body: { message: ["email must be an email", "password too short"] } });

    await expect(apiFetch("/things")).rejects.toThrow(
      "email must be an email, password too short",
    );
  });

  it("falls back to a generic message when the body has none", async () => {
    mockFetchOnce({ status: 500, bodyText: "" });

    await expect(apiFetch("/things")).rejects.toThrow("Request failed with status 500");
  });
});
