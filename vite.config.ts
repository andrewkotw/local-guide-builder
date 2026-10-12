import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  // Keep the existing local editing URL, while building for the Pages subpath.
  base: command === 'build' || isPreview ? '/local-guide-builder/' : '/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    exclude: ['e2e/**', 'scripts/**', 'node_modules/**', 'dist/**'],
  },
}))
