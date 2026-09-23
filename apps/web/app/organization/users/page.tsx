"use client";

import { useCallback, useEffect, useState, type FormEvent, type JSX } from "react";
import { AuthGate } from "../../components/auth-gate";
import { useAuth } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api-client";

interface UserResponse {
  readonly id: string;
  readonly email: string;
  readonly role: string;
}

interface InvitationResponse {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly acceptedAt: string | null;
  readonly link?: string;
}

function OrganizationUsersContent(): JSX.Element {
  const { accessToken, principal } = useAuth();
  const orgId = principal?.organizationId;
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "VIEWER">("VIEWER");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!accessToken || !orgId) {
      return;
    }
    const [userList, inviteList] = await Promise.all([
      apiFetch<UserResponse[]>(`/organizations/${orgId}/users`, { accessToken }),
      apiFetch<InvitationResponse[]>(`/organizations/${orgId}/invitations`, { accessToken }),
    ]);
    setUsers(userList);
    setInvitations(inviteList.filter((invitation) => !invitation.acceptedAt));
  }, [accessToken, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!accessToken || !orgId) {
      return;
    }
    setError(null);
    setLastLink(null);
    try {
      const invitation = await apiFetch<InvitationResponse>(
        `/organizations/${orgId}/invitations`,
        { method: "POST", accessToken, body: { email, role } },
      );
      setEmail("");
      setLastLink(invitation.link ?? null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the invitation.");
    }
  }

  async function revoke(invitationId: string): Promise<void> {
    if (!accessToken || !orgId) {
      return;
    }
    await apiFetch(`/organizations/${orgId}/invitations/${invitationId}`, {
      method: "DELETE",
      accessToken,
    });
    await load();
  }

  return (
    <main>
      <h1>People</h1>

      <h2>Members</h2>
      <ul className="list">
        {users.map((user) => (
          <li key={user.id}>
            <span>
              {user.email} — {user.role}
            </span>
          </li>
        ))}
      </ul>

      <h2>Pending invitations</h2>
      <ul className="list">
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            <span>
              {invitation.email} — {invitation.role}
            </span>
            <button
              type="button"
              onClick={() => {
                void revoke(invitation.id);
              }}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>

      <h2>Invite someone</h2>
      <form
        onSubmit={(event) => {
          void handleInvite(event);
        }}
        className="form"
      >
        <label htmlFor="invite-email">
          Email
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label htmlFor="invite-role">
          Role
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as "ADMIN" | "VIEWER")}
          >
            <option value="VIEWER">Viewer</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit">Send invite</button>
      </form>
      {lastLink && (
        <p className="invite-link">
          Share this link with them (no email is sent yet): <code>{lastLink}</code>
        </p>
      )}
    </main>
  );
}

export default function OrganizationUsersPage(): JSX.Element {
  return (
    <AuthGate roles={["ADMIN"]}>
      <OrganizationUsersContent />
    </AuthGate>
  );
}
