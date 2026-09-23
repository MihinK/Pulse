"use client";

import { useRef, useState, type FormEvent, type JSX } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import { ApiError } from "../../lib/api-client";
import {
  importDocumentFromUrl,
  listDocuments,
  uploadDocumentFile,
  type ApiDocumentResponse,
  type DocumentStatus,
} from "../../lib/documents-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const IN_PROGRESS: DocumentStatus[] = ["PENDING"];
/** Same reasoning as /runs/:id's poll interval — a parse normally finishes in a couple of
 * seconds, so this stays cheap without feeling stale. */
const POLL_INTERVAL_MS = 1500;

function statusVariant(status: DocumentStatus): "default" | "destructive" | "secondary" {
  if (status === "READY") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

export function DocumentsSection({ applicationId }: { applicationId: string }): JSX.Element {
  const { accessToken, principal } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canWrite = principal?.role === "ADMIN";

  const { data: documents } = useQuery({
    queryKey: ["applications", applicationId, "documents"],
    queryFn: () => listDocuments(accessToken as string, applicationId),
    enabled: !!accessToken,
    refetchInterval: (query) =>
      query.state.data?.some((doc) => IN_PROGRESS.includes(doc.status)) ? POLL_INTERVAL_MS : false,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["applications", applicationId, "documents"] });
  };

  const uploadFile = useMutation({
    mutationFn: (file: File) => uploadDocumentFile(accessToken as string, applicationId, file),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Upload failed. Please try again."),
  });

  const importUrl = useMutation({
    mutationFn: (value: string) => importDocumentFromUrl(accessToken as string, applicationId, value),
    onSuccess: () => {
      setError(null);
      setUrl("");
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Import failed. Please try again."),
  });

  function handleFileChange(event: FormEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    if (file) {
      uploadFile.mutate(file);
    }
    event.currentTarget.value = "";
  }

  function handleImportSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (url.trim()) {
      importUrl.mutate(url.trim());
    }
  }

  const activeDocument = documents?.find((doc: ApiDocumentResponse) => doc.isActive && doc.status === "READY");
  const busy = uploadFile.isPending || importUrl.isPending;

  return (
    <div>
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-medium">API documents</h2>
        {activeDocument && (
          <Button variant="outline" asChild>
            <Link href={`/applications/${applicationId}/endpoints`}>View endpoints</Link>
          </Button>
        )}
      </div>

      {canWrite && (
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="document-file" className="text-sm font-medium">
              Upload a spec file
            </label>
            <input
              id="document-file"
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              disabled={busy}
              onChange={handleFileChange}
              className="text-sm"
            />
          </div>
          <form onSubmit={handleImportSubmit} className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="document-url" className="text-sm font-medium">
                Or import from a URL
              </label>
              <Input
                id="document-url"
                type="url"
                placeholder="https://api.acme.test/openapi.json"
                value={url}
                disabled={busy}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy || !url.trim()}>
              {importUrl.isPending ? "Importing…" : "Import"}
            </Button>
          </form>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Spec version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Uploaded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(!documents || documents.length === 0) && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No API documents uploaded yet.
              </TableCell>
            </TableRow>
          )}
          {documents?.map((document) => (
            <TableRow key={document.id}>
              <TableCell>v{document.versionNo}</TableCell>
              <TableCell>{document.format}</TableCell>
              <TableCell>{document.specVersion ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(document.status)}>{document.status}</Badge>
                {document.status === "FAILED" && document.failureReason && (
                  <span className="ml-2 text-xs text-muted-foreground">{document.failureReason}</span>
                )}
              </TableCell>
              <TableCell>{document.isActive ? "Yes" : "—"}</TableCell>
              <TableCell>{new Date(document.createdAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
