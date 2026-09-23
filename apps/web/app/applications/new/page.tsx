"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "../../components/auth-gate";
import { useAuth } from "../../lib/auth-context";
import { createApplication, type CreateApplicationInput } from "../../lib/applications-api";
import { ApplicationForm } from "../application-form";

function NewApplicationContent(): JSX.Element {
  const { accessToken } = useAuth();
  const router = useRouter();

  async function handleSubmit(input: CreateApplicationInput): Promise<void> {
    const application = await createApplication(accessToken as string, input);
    router.push(`/applications/${application.id}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Add application</h1>
      <ApplicationForm submitLabel="Create application" onSubmit={handleSubmit} />
    </div>
  );
}

export default function NewApplicationPage(): JSX.Element {
  return (
    <AuthGate roles={["ADMIN"]}>
      <NewApplicationContent />
    </AuthGate>
  );
}
