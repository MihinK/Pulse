import type { ReactNode, JSX } from "react";
import "../tailwind.css";

/**
 * Scopes Tailwind/shadcn to /applications/* only — Next.js loads/unloads a layout's CSS with its
 * route segment, so app/globals.css (sprint 1-2's plain CSS) is never affected by this.
 */
export default function ApplicationsLayout({ children }: { children: ReactNode }): JSX.Element {
  return <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>;
}
