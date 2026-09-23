import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api-client";
import {
  createApplication,
  deleteApplication,
  getApplication,
  getAuthConfig,
  getRun,
  getRunResults,
  listApplications,
  listRuns,
  setAuthConfig,
  startManualRun,
  updateApplication,
} from "./applications-api";

vi.mock("./api-client", () => ({ apiFetch: vi.fn().mockResolvedValue(undefined) }));

const mockedApiFetch = vi.mocked(apiFetch);

describe("applications-api", () => {
  it("listApplications with no filter", async () => {
    await listApplications("tok");
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications", { accessToken: "tok" });
  });

  it("listApplications applies status/environment/search filters as query params", async () => {
    await listApplications("tok", { status: "UP", environment: "PROD", search: "api" });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/applications?status=UP&environment=PROD&search=api",
      { accessToken: "tok" },
    );
  });

  it("getApplication", async () => {
    await getApplication("tok", "app-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1", { accessToken: "tok" });
  });

  it("createApplication", async () => {
    const input = { name: "API", baseUrl: "https://api.acme.test", environment: "PROD" as const };
    await createApplication("tok", input);
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications", {
      method: "POST",
      accessToken: "tok",
      body: input,
    });
  });

  it("updateApplication", async () => {
    await updateApplication("tok", "app-1", { name: "New name" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1", {
      method: "PATCH",
      accessToken: "tok",
      body: { name: "New name" },
    });
  });

  it("deleteApplication", async () => {
    await deleteApplication("tok", "app-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1", {
      method: "DELETE",
      accessToken: "tok",
    });
  });

  it("getAuthConfig", async () => {
    await getAuthConfig("tok", "app-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1/auth", { accessToken: "tok" });
  });

  it("setAuthConfig", async () => {
    await setAuthConfig("tok", "app-1", "BEARER", { token: "x" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1/auth", {
      method: "PUT",
      accessToken: "tok",
      body: { type: "BEARER", credentials: { token: "x" } },
    });
  });

  it("startManualRun", async () => {
    await startManualRun("tok", "app-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1/runs", {
      method: "POST",
      accessToken: "tok",
    });
  });

  it("listRuns", async () => {
    await listRuns("tok", "app-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/applications/app-1/runs", { accessToken: "tok" });
  });

  it("getRun", async () => {
    await getRun("tok", "run-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/runs/run-1", { accessToken: "tok" });
  });

  it("getRunResults", async () => {
    await getRunResults("tok", "run-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/runs/run-1/results", { accessToken: "tok" });
  });
});
