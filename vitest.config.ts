import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    coverage: {
      include: ["hooks/**", "lib/**"],
      provider: "v8",
      // Keep the well-tested pure logic from silently regressing. Raise these
      // (and add globs) as more of lib/ and hooks/ gains tests.
      thresholds: {
        "lib/markdown/**": {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
    environment: "node",
  },
});
