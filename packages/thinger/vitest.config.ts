import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/cli.ts"],
      reporter: ["text-summary"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 90,
      },
    },
  },
});
