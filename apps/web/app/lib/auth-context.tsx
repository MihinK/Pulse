"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "./api-client";

export type Role = "PLATFORM_OWNER" | "ADMIN" | "VIEWER";

export interface Principal {
  readonly userId: string;
  readonly organizationId: string | null;
  readonly role: Role;
}

export interface SessionResponse extends Principal {
  readonly accessToken: string;
}

export interface AuthContextValue {
  readonly principal: Principal | null;
  readonly accessToken: string | null;
  /** True until the initial silent refresh (restoring a session from the cookie) settles. */
  readonly loading: boolean;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly logout: () => Promise<void>;
  /** Used by the accept-invite page, which gets a session back directly from its own endpoint. */
  readonly applySession: (session: SessionResponse) => void;
}

function toPrincipal(session: SessionResponse): Principal {
  return { userId: session.userId, organizationId: session.organizationId, role: session.role };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<SessionResponse>("/auth/refresh", { method: "POST" })
      .then((session) => {
        if (cancelled) {
          return;
        }
        setAccessToken(session.accessToken);
        setPrincipal(toPrincipal(session));
      })
      .catch(() => {
        // No valid refresh cookie — the visitor simply isn't signed in yet.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback((session: SessionResponse): void => {
    setAccessToken(session.accessToken);
    setPrincipal(toPrincipal(session));
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const session = await apiFetch<SessionResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async (): Promise<void> => {
    await apiFetch<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
    setPrincipal(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ principal, accessToken, loading, login, logout, applySession }),
    [principal, accessToken, loading, login, logout, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() must be used within an <AuthProvider>");
  }
  return context;
}
