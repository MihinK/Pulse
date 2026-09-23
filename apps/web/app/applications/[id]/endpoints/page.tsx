"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "../../../components/auth-gate";
import { useAuth } from "../../../lib/auth-context";
import { getApplication } from "../../../lib/applications-api";
import { listDocuments, listEndpoints, patchEndpoint, type EndpointResponse } from "../../../lib/documents-api";
import { Button } from "@/components/ui/button";

/** Groups by the endpoint's first path segment (`/users/:id` -> "users") — the data model has no
 * `tag` column, so this is the pragmatic client-side stand-in the sprint 4 plan calls for. */
function groupKey(path: string): string {
  const segment = path.split("/").find((part) => part.length > 0);
  return segment ?? "/";
}

function EndpointRow({ endpoint, canWrite }: { endpoint: EndpointResponse; canWrite: boolean }): JSX.Element {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [paramsText, setParamsText] = useState(JSON.stringify(endpoint.sampleParams ?? {}, null, 2));
  const [bodyText, setBodyText] = useState(JSON.stringify(endpoint.sampleBody ?? {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["documents", endpoint.apiDocumentId, "endpoints"] });
  };

  const toggleIncluded = useMutation({
    mutationFn: () => patchEndpoint(accessToken as string, endpoint.id, { included: !endpoint.included }),
    onSuccess: invalidate,
  });

  const saveSamples = useMutation({
    mutationFn: (input: { sampleParams: Record<string, unknown>; sampleBody: Record<string, unknown> }) =>
      patchEndpoint(accessToken as string, endpoint.id, input),
    onSuccess: invalidate,
  });

  function handleSaveSamples(): void {
    try {
      const sampleParams = JSON.parse(paramsText) as Record<string, unknown>;
      const sampleBody = JSON.parse(bodyText) as Record<string, unknown>;
      setJsonError(null);
      saveSamples.mutate({ sampleParams, sampleBody });
    } catch {
      setJsonError("Sample params and body must both be valid JSON objects.");
    }
  }

  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="w-16 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
          {endpoint.method}
        </span>
        <span className="font-mono text-sm">{endpoint.path}</span>
        {endpoint.operationId && (
          <span className="text-xs text-muted-foreground">({endpoint.operationId})</span>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={endpoint.included}
            disabled={!canWrite || toggleIncluded.isPending}
            onChange={() => toggleIncluded.mutate()}
          />
          Included
        </label>
      </div>

      {canWrite && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`params-${endpoint.id}`} className="text-xs font-medium text-muted-foreground">
              Sample params (JSON)
            </label>
            <textarea
              id={`params-${endpoint.id}`}
              className="min-h-20 rounded-md border px-2 py-1 font-mono text-xs"
              value={paramsText}
              onChange={(event) => setParamsText(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`body-${endpoint.id}`} className="text-xs font-medium text-muted-foreground">
              Sample body (JSON)
            </label>
            <textarea
              id={`body-${endpoint.id}`}
              className="min-h-20 rounded-md border px-2 py-1 font-mono text-xs"
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" variant="outline" onClick={handleSaveSamples} disabled={saveSamples.isPending}>
              {saveSamples.isPending ? "Saving…" : "Save sample values"}
            </Button>
            {jsonError && <span className="ml-3 text-xs text-destructive">{jsonError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function EndpointsContent(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { accessToken, principal } = useAuth();
  const canWrite = principal?.role === "ADMIN";

  const { data: application } = useQuery({
    queryKey: ["applications", id],
    queryFn: () => getApplication(accessToken as string, id),
    enabled: !!accessToken,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["applications", id, "documents"],
    queryFn: () => listDocuments(accessToken as string, id),
    enabled: !!accessToken,
  });

  const activeDocument = documents?.find((doc) => doc.isActive && doc.status === "READY");

  const { data: endpoints, isLoading: endpointsLoading } = useQuery({
    queryKey: ["documents", activeDocument?.id, "endpoints"],
    queryFn: () => listEndpoints(accessToken as string, activeDocument?.id as string),
    enabled: !!accessToken && !!activeDocument,
  });

  if (documentsLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!activeDocument) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Endpoints</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          No active API document yet.{" "}
          <Link href={`/applications/${id}`} className="hover:underline">
            Upload one from the application page
          </Link>
          .
        </p>
      </div>
    );
  }

  const groups = new Map<string, EndpointResponse[]>();
  for (const endpoint of endpoints ?? []) {
    const key = groupKey(endpoint.path);
    const group = groups.get(key) ?? [];
    group.push(endpoint);
    groups.set(key, group);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Endpoints</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        <Link href={`/applications/${id}`} className="hover:underline">
          {application?.name ?? "Back to application"}
        </Link>
        {" · "}v{activeDocument.versionNo} ({activeDocument.format})
      </p>

      {endpointsLoading && <p className="mt-6 text-sm text-muted-foreground">Loading endpoints…</p>}

      {!endpointsLoading && (endpoints?.length ?? 0) === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">This document has no endpoints.</p>
      )}

      {[...groups.entries()].map(([group, groupEndpoints]) => (
        <div key={group} className="mt-8">
          <h2 className="text-lg font-medium">{group}</h2>
          <div className="mt-2">
            {groupEndpoints.map((endpoint) => (
              <EndpointRow key={endpoint.id} endpoint={endpoint} canWrite={canWrite} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EndpointsPage(): JSX.Element {
  return (
    <AuthGate roles={["ADMIN", "VIEWER"]}>
      <EndpointsContent />
    </AuthGate>
  );
}
