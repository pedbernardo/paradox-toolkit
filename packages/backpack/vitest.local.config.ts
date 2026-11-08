import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.local.ts'],
    pool: 'forks',
    testTimeout: 300_000
  }
})
