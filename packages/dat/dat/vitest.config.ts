import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.local.ts"],
      reporter: ["text-summary"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 85,
        statements: 90,
      },
    },
  },
});
