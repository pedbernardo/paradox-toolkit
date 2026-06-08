import { defineConfig } from 'vitest/config'

process.env['NODE_OPTIONS'] = '--max-old-space-size=8192'

export default defineConfig({
  test: {
    include: ['tests/**/*.local.ts'],
    pool: 'forks'
  }
})
