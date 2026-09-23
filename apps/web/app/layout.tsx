import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "./lib/auth-context";
import { SiteNav } from "./components/site-nav";

export const metadata: Metadata = {
  title: "Pulse",
  description: "Health-check platform for applications and their APIs.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SiteNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
