"use client";

import { useEffect, type ReactNode, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type Role } from "../lib/auth-context";

interface AuthGateProps {
  /** Omit to allow any authenticated principal, regardless of role. */
  roles?: readonly Role[];
  children: ReactNode;
}

/** Redirects to `/login` when unauthenticated, or `/` when the principal's role doesn't match. */
export function AuthGate({ roles, children }: AuthGateProps): JSX.Element {
  const { principal, loading } = useAuth();
  const router = useRouter();
  const allowed = !!principal && (!roles || roles.includes(principal.role));

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!principal) {
      router.replace("/login");
      return;
    }
    if (roles && !roles.includes(principal.role)) {
      router.replace("/");
    }
  }, [loading, principal, roles, router]);

  if (loading || !allowed) {
    return <p className="page-status">Loading…</p>;
  }

  return <>{children}</>;
}
