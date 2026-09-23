"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "../../components/auth-gate";
import { useAuth } from "../../lib/auth-context";
import { getRun, getRunResults, type CheckRunStatus } from "../../lib/applications-api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const IN_PROGRESS: CheckRunStatus[] = ["QUEUED", "RUNNING"];
/** How often to re-poll a run that hasn't finished yet — fast enough to feel live, cheap enough
 * not to hammer the API for the few seconds a check normally takes. */
const POLL_INTERVAL_MS = 1500;

function RunContent(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();

  const { data: run, isLoading, error } = useQuery({
    queryKey: ["runs", id],
    queryFn: () => getRun(accessToken as string, id),
    enabled: !!accessToken,
    refetchInterval: (query) =>
      query.state.data && IN_PROGRESS.includes(query.state.data.status) ? POLL_INTERVAL_MS : false,
  });

  const { data: results } = useQuery({
    queryKey: ["runs", id, "results"],
    queryFn: () => getRunResults(accessToken as string, id),
    enabled: !!accessToken && !!run && !IN_PROGRESS.includes(run.status),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (error || !run) {
    return <p className="text-sm text-destructive">Could not load this run.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Run</h1>
        <Badge>{run.status}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        <Link href={`/applications/${run.applicationId}`} className="hover:underline">
          Back to application
        </Link>
      </p>

      {IN_PROGRESS.includes(run.status) && (
        <p className="mt-6 text-sm text-muted-foreground">Waiting for the check to finish…</p>
      )}

      {!IN_PROGRESS.includes(run.status) && (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-muted-foreground">Passed</dt>
              <dd className="text-lg font-medium">{run.passed}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Failed</dt>
              <dd className="text-lg font-medium">{run.failed}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Avg response</dt>
              <dd className="text-lg font-medium">{run.avgMs !== undefined ? `${run.avgMs} ms` : "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">p95</dt>
              <dd className="text-lg font-medium">{run.p95Ms !== undefined ? `${run.p95Ms} ms` : "—"}</dd>
            </div>
          </dl>

          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Status code</TableHead>
                <TableHead>Response time</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results?.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>{result.url}</TableCell>
                  <TableCell>{result.statusCode ?? "—"}</TableCell>
                  <TableCell>{result.responseMs !== undefined ? `${result.responseMs} ms` : "—"}</TableCell>
                  <TableCell>
                    {result.outcome}
                    {result.failureReason ? ` — ${result.failureReason}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

export default function RunPage(): JSX.Element {
  return (
    <AuthGate roles={["ADMIN", "VIEWER"]}>
      <RunContent />
    </AuthGate>
  );
}
