/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite + React (strict TS) configuration for the stylus_arm digital twin.
// Vitest is configured inline via the `test` field.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
