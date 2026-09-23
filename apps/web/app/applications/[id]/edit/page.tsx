"use client";

import type { JSX } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "../../../components/auth-gate";
import { useAuth } from "../../../lib/auth-context";
import { getApplication, updateApplication, type CreateApplicationInput } from "../../../lib/applications-api";
import { ApplicationForm } from "../../application-form";

function EditApplicationContent(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const { data: application, isLoading, error } = useQuery({
    queryKey: ["applications", id],
    queryFn: () => getApplication(accessToken as string, id),
    enabled: !!accessToken,
  });

  async function handleSubmit(input: CreateApplicationInput): Promise<void> {
    await updateApplication(accessToken as string, id, input);
    router.push(`/applications/${id}`);
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (error || !application) {
    return <p className="text-sm text-destructive">Could not load this application.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Edit {application.name}</h1>
      <ApplicationForm
        submitLabel="Save changes"
        initialValues={{
          name: application.name,
          baseUrl: application.baseUrl,
          environment: application.environment,
          description: application.description ?? "",
          checkIntervalMinutes: application.checkIntervalMinutes,
          timeoutMs: application.timeoutMs,
          slowThresholdMs: application.slowThresholdMs,
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default function EditApplicationPage(): JSX.Element {
  return (
    <AuthGate roles={["ADMIN"]}>
      <EditApplicationContent />
    </AuthGate>
  );
}
