import { apiFetch, ApiError } from "./api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export type DocumentFormat = "OPENAPI_3" | "SWAGGER_2" | "POSTMAN_V21";
export type DocumentStatus = "PENDING" | "READY" | "FAILED";

export interface ApiDocumentResponse {
  readonly id: string;
  readonly applicationId: string;
  readonly format: DocumentFormat;
  readonly specVersion?: string;
  readonly versionNo: number;
  readonly isActive: boolean;
  readonly status: DocumentStatus;
  readonly failureReason?: string;
  readonly uploadedByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EndpointResponse {
  readonly id: string;
  readonly apiDocumentId: string;
  readonly method: string;
  readonly path: string;
  readonly operationId?: string;
  readonly expectedStatuses?: number[];
  readonly responseSchema?: Record<string, unknown>;
  readonly sampleParams?: Record<string, unknown>;
  readonly sampleBody?: Record<string, unknown>;
  readonly included: boolean;
  readonly writeEnabled: boolean;
  readonly allowInSchedule: boolean;
}

export interface PatchEndpointInput {
  included?: boolean;
  sampleParams?: Record<string, unknown>;
  sampleBody?: Record<string, unknown>;
}

export function listDocuments(accessToken: string, applicationId: string): Promise<ApiDocumentResponse[]> {
  return apiFetch(`/applications/${applicationId}/documents`, { accessToken });
}

export function importDocumentFromUrl(
  accessToken: string,
  applicationId: string,
  url: string,
): Promise<ApiDocumentResponse> {
  return apiFetch(`/applications/${applicationId}/documents`, {
    method: "POST",
    accessToken,
    body: { url },
  });
}

/**
 * Multipart upload bypasses `apiFetch` — it always JSON-encodes `body` and sets
 * `Content-Type: application/json`, which would corrupt a file part. The browser must set its own
 * `multipart/form-data` boundary, so this builds the request by hand instead.
 */
export async function uploadDocumentFile(
  accessToken: string,
  applicationId: string,
  file: File,
): Promise<ApiDocumentResponse> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/documents`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return data as ApiDocumentResponse;
}

export function listEndpoints(accessToken: string, documentId: string): Promise<EndpointResponse[]> {
  return apiFetch(`/documents/${documentId}/endpoints`, { accessToken });
}

export function patchEndpoint(
  accessToken: string,
  endpointId: string,
  input: PatchEndpointInput,
): Promise<EndpointResponse> {
  return apiFetch(`/endpoints/${endpointId}`, { method: "PATCH", accessToken, body: input });
}
