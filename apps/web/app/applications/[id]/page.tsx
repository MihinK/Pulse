"use client";

import type { JSX } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AuthGate } from "../../components/auth-gate";
import { useAuth } from "../../lib/auth-context";
import { StatusBadge } from "../../components/status-badge";
import { getApplication, listRuns, startManualRun } from "../../lib/applications-api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function ApplicationDetailContent(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { accessToken, principal } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: application, isLoading, error } = useQuery({
    queryKey: ["applications", id],
    queryFn: () => getApplication(accessToken as string, id),
    enabled: !!accessToken,
  });

  const { data: runs } = useQuery({
    queryKey: ["applications", id, "runs"],
    queryFn: () => listRuns(accessToken as string, id),
    enabled: !!accessToken,
  });

  const checkNow = useMutation({
    mutationFn: () => startManualRun(accessToken as string, id),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ["applications", id] });
      router.push(`/runs/${run.id}`);
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (error || !application) {
    return <p className="text-sm text-destructive">Could not load this application.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{application.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{application.baseUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={application.status} />
          {principal?.role === "ADMIN" && (
            <Button variant="outline" asChild>
              <Link href={`/applications/${id}/edit`}>Edit</Link>
            </Button>
          )}
          <Button
            onClick={() => checkNow.mutate()}
            disabled={checkNow.isPending}
          >
            {checkNow.isPending ? "Checking…" : "Check now"}
          </Button>
        </div>
      </div>

      {application.description && (
        <p className="mt-4 text-sm text-muted-foreground">{application.description}</p>
      )}

      <h2 className="mt-8 text-lg font-medium">Recent runs</h2>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Passed</TableHead>
            <TableHead>Failed</TableHead>
            <TableHead>Avg response</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(!runs || runs.length === 0) && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No runs yet.
              </TableCell>
            </TableRow>
          )}
          {runs?.map((run) => (
            <TableRow key={run.id}>
              <TableCell>
                <Link href={`/runs/${run.id}`} className="hover:underline">
                  {new Date(run.createdAt).toLocaleString()}
                </Link>
              </TableCell>
              <TableCell>{run.status}</TableCell>
              <TableCell>{run.passed}</TableCell>
              <TableCell>{run.failed}</TableCell>
              <TableCell>{run.avgMs !== undefined ? `${run.avgMs} ms` : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ApplicationDetailPage(): JSX.Element {
  return (
    <AuthGate roles={["ADMIN", "VIEWER"]}>
      <ApplicationDetailContent />
    </AuthGate>
  );
}
