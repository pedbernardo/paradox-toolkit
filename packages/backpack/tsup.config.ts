import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/content.ts', 'src/sprites.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true
})
