"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";

export function SiteNav(): JSX.Element {
  const { principal, logout, loading } = useAuth();
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    await logout();
    router.push("/login");
  }

  return (
    <nav className="site-nav">
      <Link href="/">Pulse</Link>
      <span className="spacer" />
      {!loading && principal && (
        <>
          {principal.role === "PLATFORM_OWNER" && (
            <Link href="/admin/organizations">Organisations</Link>
          )}
          {principal.role !== "PLATFORM_OWNER" && <Link href="/organization/users">People</Link>}
          <Link href="/profile">Profile</Link>
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
          >
            Sign out
          </button>
        </>
      )}
      {!loading && !principal && <Link href="/login">Sign in</Link>}
    </nav>
  );
}
