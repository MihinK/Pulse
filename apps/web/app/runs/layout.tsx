import type { ReactNode, JSX } from "react";
import "../tailwind.css";

/** Scopes Tailwind/shadcn to /runs/* only — see app/applications/layout.tsx for why. */
export default function RunsLayout({ children }: { children: ReactNode }): JSX.Element {
  return <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>;
}
