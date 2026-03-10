import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/__tests__/e2e/**",
      "**/e2e/**",
    ],
  },
});
