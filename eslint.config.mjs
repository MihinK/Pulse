// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        { accessibility: "explicit" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Test doubles routinely implement an async interface without every branch needing an
    // `await` (e.g. a fake repository's `save()` just resolving immediately), and Jest's
    // `expect(mock.method).toHaveBeenCalledWith(...)` pattern inherently takes a detached
    // reference to a method — the `this`-binding hazard `unbound-method` guards against in
    // production code doesn't apply to a jest.fn() being handed to an assertion.
    files: ["**/*.spec.ts", "**/*.spec.tsx", "**/*.e2e-spec.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    // Plain CommonJS config/helper scripts (e.g. babel.config.cjs, test/babel-transformer.cjs) —
    // not part of any tsconfig "include", so the type-aware parser can't project them.
    ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/node_modules/**", "**/*.cjs"],
  },
);
