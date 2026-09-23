import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors tsconfig.json's "@/*" path alias — Next.js reads that natively, Vite/Vitest doesn't.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.spec.{ts,tsx}", "components/**/*.spec.{ts,tsx}", "lib/**/*.spec.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.spec.{ts,tsx}",
        "components/**/*.spec.{ts,tsx}",
        "lib/**/*.spec.{ts,tsx}",
        "app/layout.tsx",
        "app/page.tsx",
        // Framework wiring, not business logic — same rationale as app/layout.tsx above.
        "app/**/layout.tsx",
        // Vendored shadcn/ui primitives (Radix + class-variance-authority wiring) — not
        // hand-written business logic, same rationale as excluding *.module.ts on the backend.
        "components/ui/**",
        // Test-only helpers, same rationale as apps/api's test-support/** exclusion.
        "app/test-support/**",
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
