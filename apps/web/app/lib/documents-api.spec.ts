import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./api-client";
import {
  importDocumentFromUrl,
  listDocuments,
  listEndpoints,
  patchEndpoint,
  uploadDocumentFile,
} from "./documents-api";

vi.mock("./api-client", async () => {
  const actual = await vi.importActual<typeof import("./api-client")>("./api-client");
  return { ...actual, apiFetch: vi.fn().mockResolvedValue(undefined) };
});

const mockedApiFetch = vi.mocked(apiFetch);

function mockFetchOnce(response: { status: number; body?: unknown }): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    text: () => Promise.resolve(response.body !== undefined ? JSON.stringify(response.body) : ""),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("documents-api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listDocuments", async () => {
    await listDocuments("tok", "app-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1/documents", { accessToken: "tok" });
  });

  it("importDocumentFromUrl", async () => {
    await importDocumentFromUrl("tok", "app-1", "https://example.test/spec.yaml");
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1/documents", {
      method: "POST",
      accessToken: "tok",
      body: { url: "https://example.test/spec.yaml" },
    });
  });

  it("listEndpoints", async () => {
    await listEndpoints("tok", "doc-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/documents/doc-1/endpoints", { accessToken: "tok" });
  });

  it("patchEndpoint", async () => {
    await patchEndpoint("tok", "ep-1", { included: false });
    expect(mockedApiFetch).toHaveBeenCalledWith("/endpoints/ep-1", {
      method: "PATCH",
      accessToken: "tok",
      body: { included: false },
    });
  });

  it("uploadDocumentFile sends the file as multipart form data with a bearer token, no explicit Content-Type", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: { id: "doc-1" } });
    const file = new File(["openapi: 3.0.0"], "spec.yaml");

    const result = await uploadDocumentFile("tok", "app-1", file);

    expect(result).toEqual({ id: "doc-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/applications/app-1/documents");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("uploadDocumentFile throws ApiError with the server's message on failure", async () => {
    mockFetchOnce({ status: 400, body: { message: "Unrecognized spec format" } });
    const file = new File(["garbage"], "spec.yaml");

    await expect(uploadDocumentFile("tok", "app-1", file)).rejects.toMatchObject(
      new ApiError(400, "Unrecognized spec format"),
    );
  });

  it("uploadDocumentFile falls back to a generic message when the body has none", async () => {
    mockFetchOnce({ status: 500 });
    const file = new File(["x"], "spec.yaml");

    await expect(uploadDocumentFile("tok", "app-1", file)).rejects.toThrow("Request failed with status 500");
  });
});
