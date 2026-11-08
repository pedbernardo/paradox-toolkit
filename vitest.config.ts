import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'fixtures', 'examples'],
    exclude: ['node_modules/**', 'dist/**']
  }
})
