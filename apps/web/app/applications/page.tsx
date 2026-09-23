"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "../components/auth-gate";
import { useAuth } from "../lib/auth-context";
import { StatusBadge, type AppStatus } from "../components/status-badge";
import { listApplications, type Environment } from "../lib/applications-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUSES: AppStatus[] = ["UP", "DEGRADED", "DOWN", "UNKNOWN"];
const ENVIRONMENTS: Environment[] = ["DEV", "STAGING", "PROD"];

function ApplicationsContent(): JSX.Element {
  const { accessToken, principal } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AppStatus | "ALL">("ALL");
  const [environment, setEnvironment] = useState<Environment | "ALL">("ALL");

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["applications", { search, status, environment }],
    queryFn: () =>
      listApplications(accessToken as string, {
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
        environment: environment === "ALL" ? undefined : environment,
      }),
    enabled: !!accessToken,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
        {principal?.role === "ADMIN" && (
          <Button asChild>
            <Link href="/applications/new">Add application</Link>
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={(value) => setStatus(value as AppStatus | "ALL")}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={environment}
          onValueChange={(value) => setEnvironment(value as Environment | "ALL")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All environments</SelectItem>
            {ENVIRONMENTS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-sm text-destructive">Could not load applications.</p>}

      {applications && (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Base URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No applications yet.
                </TableCell>
              </TableRow>
            )}
            {applications.map((application) => (
              <TableRow key={application.id}>
                <TableCell>
                  <Link href={`/applications/${application.id}`} className="font-medium hover:underline">
                    {application.name}
                  </Link>
                </TableCell>
                <TableCell>{application.environment}</TableCell>
                <TableCell>
                  <StatusBadge status={application.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{application.baseUrl}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function ApplicationsPage(): JSX.Element {
  return (
    <AuthGate roles={["ADMIN", "VIEWER"]}>
      <ApplicationsContent />
    </AuthGate>
  );
}
