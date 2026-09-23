"use client";

import { useState, type JSX, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** One QueryClient per browser session (not per render) — created lazily so it survives fast refresh. */
export function QueryProvider({ children }: { children: ReactNode }): JSX.Element {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
