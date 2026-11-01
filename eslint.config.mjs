import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The admin app is a separate project: its own dependencies, its own
    // tsconfig, and Preact rather than React, so this configuration judges it
    // against rules it was never written for. web/dist is build output, and
    // linting minified bundles produced 294 of the 300 problems this config
    // reported before it was ignored.
    "web/**",
    // The same bundle again, copied into the Go module before the build. It
    // is minified output either way, and linting it reported 298 problems
    // that belong to a minifier rather than to anyone's code.
    "api/internal/web/dist/**",
  ]),
]);

export default eslintConfig;
