"use client";

import { useState, type FormEvent, type JSX } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth, type SessionResponse } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api-client";

export default function AcceptInvitePage(): JSX.Element {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { applySession } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await apiFetch<SessionResponse>(`/invitations/${params.token}/accept`, {
        method: "POST",
        body: { password },
      });
      applySession(session);
      router.push("/profile");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "This invitation link is invalid or has expired.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Set your password</h1>
      <p>Choose a password to finish creating your Pulse account.</p>
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="form"
      >
        <label htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Accept invitation"}
        </button>
      </form>
    </main>
  );
}
