"use client";

import { useEffect, useState, type JSX } from "react";
import { AuthGate } from "../components/auth-gate";
import { useAuth } from "../lib/auth-context";
import { apiFetch, ApiError } from "../lib/api-client";

interface UserResponse {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly organizationId: string | null;
  readonly timeZone: string;
}

function supportedTimeZones(): string[] {
  // "UTC" is a valid IANA zone accepted by Intl.DateTimeFormat (and the default for every new
  // user/org — see User.timeZone) but Intl.supportedValuesOf("timeZone") never lists it, only
  // full IANA region/city names. Without prepending it, a user whose stored zone is "UTC" sees
  // the <select> fall back to whatever renders first (alphabetically, "Africa/Abidjan") and can
  // silently change their zone just by hitting Save without touching the dropdown.
  try {
    return ["UTC", ...Intl.supportedValuesOf("timeZone")];
  } catch {
    return ["UTC"];
  }
}

function ProfileContent(): JSX.Element {
  const { accessToken } = useAuth();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [timeZone, setTimeZone] = useState("UTC");
  const [zones] = useState<string[]>(supportedTimeZones);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    apiFetch<UserResponse>("/users/me", { accessToken })
      .then((fetched) => {
        setUser(fetched);
        setTimeZone(fetched.timeZone);
      })
      .catch(() => undefined);
  }, [accessToken]);

  async function handleSave(): Promise<void> {
    if (!accessToken) {
      return;
    }
    setError(null);
    setStatus(null);
    try {
      const updated = await apiFetch<UserResponse>("/users/me", {
        method: "PATCH",
        accessToken,
        body: { timeZone },
      });
      setUser(updated);
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your time zone.");
    }
  }

  if (!user) {
    return <p className="page-status">Loading…</p>;
  }

  return (
    <main>
      <h1>Profile</h1>
      <dl className="profile-details">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Role</dt>
        <dd>{user.role}</dd>
      </dl>
      <div className="form">
        <label htmlFor="timezone">
          Time zone
          <select
            id="timezone"
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
        >
          Save
        </button>
        {status && <p role="status">{status}</p>}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

export default function ProfilePage(): JSX.Element {
  return (
    <AuthGate>
      <ProfileContent />
    </AuthGate>
  );
}
