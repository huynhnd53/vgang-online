import { defineConfig } from 'vitest/config';

// Relative base so the build works both at https://<user>.github.io/vgang-online/
// and on a custom domain or another static host without changes.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
