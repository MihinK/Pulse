"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AuthGate } from "../../components/auth-gate";
import { useAuth } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api-client";

interface OrganizationResponse {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: "ACTIVE" | "SUSPENDED";
  readonly defaultTimeZone: string;
}

function AdminOrganizationsContent(): JSX.Element {
  const { accessToken } = useAuth();
  const [orgs, setOrgs] = useState<OrganizationResponse[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }
    const list = await apiFetch<OrganizationResponse[]>("/organizations", { accessToken });
    setOrgs(list);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setError(null);
    try {
      await apiFetch("/organizations", {
        method: "POST",
        accessToken,
        body: { name, slug, defaultTimeZone: timeZone },
      });
      setName("");
      setSlug("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the organisation.");
    }
  }

  async function toggleActive(org: OrganizationResponse): Promise<void> {
    if (!accessToken) {
      return;
    }
    await apiFetch(`/organizations/${org.id}`, {
      method: "PATCH",
      accessToken,
      body: { active: org.status !== "ACTIVE" },
    });
    await load();
  }

  return (
    <main>
      <h1>Organisations</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orgs.map((org) => (
            <tr key={org.id}>
              <td>{org.name}</td>
              <td>{org.slug}</td>
              <td>{org.status}</td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    void toggleActive(org);
                  }}
                >
                  {org.status === "ACTIVE" ? "Suspend" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Create organisation</h2>
      <form
        onSubmit={(event) => {
          void handleCreate(event);
        }}
        className="form"
      >
        <label htmlFor="org-name">
          Name
          <input
            id="org-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label htmlFor="org-slug">
          Slug
          <input
            id="org-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Lowercase letters, numbers and hyphens only"
          />
        </label>
        <label htmlFor="org-timezone">
          Default time zone
          <input
            id="org-timezone"
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit">Create</button>
      </form>
    </main>
  );
}

export default function AdminOrganizationsPage(): JSX.Element {
  return (
    <AuthGate roles={["PLATFORM_OWNER"]}>
      <AdminOrganizationsContent />
    </AuthGate>
  );
}
