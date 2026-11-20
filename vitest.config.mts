import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // PDF rendering is CPU-heavy; run files one at a time so the font
    // cross-render regression test runs in a single process like production
    fileParallelism: false,
    testTimeout: 60_000,
  },
})
