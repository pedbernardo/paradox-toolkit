import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'fixtures'],
    exclude: ['node_modules/**', 'dist/**']
  }
})
