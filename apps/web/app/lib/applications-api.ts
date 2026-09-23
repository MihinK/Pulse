import { apiFetch } from "./api-client";
import type { AppStatus } from "../components/status-badge";

export type Environment = "DEV" | "STAGING" | "PROD";
export type AuthType = "NONE" | "API_KEY" | "BEARER" | "BASIC" | "OAUTH2_CC" | "LOGIN_FLOW";
export type CheckRunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type Outcome = "PASSED" | "FAILED" | "DEGRADED" | "SKIPPED";

export interface ApplicationResponse {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly environment: Environment;
  readonly description?: string;
  readonly tags: string[];
  readonly checkIntervalMinutes: number;
  readonly timeoutMs: number;
  readonly slowThresholdMs: number;
  readonly expectedStatuses: number[] | null;
  readonly schemaValidation: boolean;
  readonly status: AppStatus;
  readonly createdAt: string;
}

export interface CreateApplicationInput {
  name: string;
  baseUrl: string;
  environment: Environment;
  description?: string | undefined;
  checkIntervalMinutes?: number | undefined;
  timeoutMs?: number | undefined;
  slowThresholdMs?: number | undefined;
}

export type UpdateApplicationInput = Partial<CreateApplicationInput>;

export interface AuthConfigResponse {
  readonly type: AuthType;
}

export interface CheckRunResponse {
  readonly id: string;
  readonly applicationId: string;
  readonly trigger: "MANUAL" | "SCHEDULED";
  readonly status: CheckRunStatus;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly avgMs?: number;
  readonly p95Ms?: number;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export interface CheckResultResponse {
  readonly id: string;
  readonly method: string;
  readonly url: string;
  readonly statusCode?: number;
  readonly responseMs?: number;
  readonly outcome: Outcome;
  readonly failureReason?: string;
  readonly checkedAt: string;
}

export interface ApplicationFilter {
  status?: AppStatus | undefined;
  environment?: Environment | undefined;
  search?: string | undefined;
}

function toQueryString(filter: ApplicationFilter): string {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.environment) params.set("environment", filter.environment);
  if (filter.search) params.set("search", filter.search);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listApplications(
  accessToken: string,
  filter: ApplicationFilter = {},
): Promise<ApplicationResponse[]> {
  return apiFetch(`/applications${toQueryString(filter)}`, { accessToken });
}

export function getApplication(accessToken: string, id: string): Promise<ApplicationResponse> {
  return apiFetch(`/applications/${id}`, { accessToken });
}

export function createApplication(
  accessToken: string,
  input: CreateApplicationInput,
): Promise<ApplicationResponse> {
  return apiFetch("/applications", { method: "POST", accessToken, body: input });
}

export function updateApplication(
  accessToken: string,
  id: string,
  input: UpdateApplicationInput,
): Promise<ApplicationResponse> {
  return apiFetch(`/applications/${id}`, { method: "PATCH", accessToken, body: input });
}

export function deleteApplication(accessToken: string, id: string): Promise<void> {
  return apiFetch(`/applications/${id}`, { method: "DELETE", accessToken });
}

export function getAuthConfig(accessToken: string, id: string): Promise<AuthConfigResponse> {
  return apiFetch(`/applications/${id}/auth`, { accessToken });
}

export function setAuthConfig(
  accessToken: string,
  id: string,
  type: AuthType,
  credentials?: Record<string, string>,
): Promise<AuthConfigResponse> {
  return apiFetch(`/applications/${id}/auth`, {
    method: "PUT",
    accessToken,
    body: { type, credentials },
  });
}

export function startManualRun(accessToken: string, applicationId: string): Promise<CheckRunResponse> {
  return apiFetch(`/applications/${applicationId}/runs`, { method: "POST", accessToken });
}

export function listRuns(accessToken: string, applicationId: string): Promise<CheckRunResponse[]> {
  return apiFetch(`/applications/${applicationId}/runs`, { accessToken });
}

export function getRun(accessToken: string, runId: string): Promise<CheckRunResponse> {
  return apiFetch(`/runs/${runId}`, { accessToken });
}

export function getRunResults(accessToken: string, runId: string): Promise<CheckResultResponse[]> {
  return apiFetch(`/runs/${runId}/results`, { accessToken });
}
