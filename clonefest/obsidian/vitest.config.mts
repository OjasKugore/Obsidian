import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Use the built-in Web Crypto, CompressionStream, etc. from happy-dom / node
    environment: 'node',

    // Enable globals (describe, it, expect) without explicit imports
    globals: false,

    // Only run unit tests here — E2E is handled by Playwright separately
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],

    // Longer timeout for KDF tests (PBKDF2 at 100k iterations ≈ 500ms per call)
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
    },
  },
});
