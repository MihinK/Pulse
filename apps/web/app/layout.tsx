import type { Metadata } from "next";
import type { ReactNode, JSX } from "react";
import "./globals.css";
import { AuthProvider } from "./lib/auth-context";
import { QueryProvider } from "./lib/query-provider";
import { SiteNav } from "./components/site-nav";

export const metadata: Metadata = {
  title: "Pulse",
  description: "Health-check platform for applications and their APIs.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthProvider>
            <SiteNav />
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
