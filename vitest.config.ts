import { readFileSync } from 'node:fs';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  // Same build-time constants as tsdown.config.ts for the ESM/CJS builds.
  define: { __VERSION__: JSON.stringify(version), __NF_IIFE__: 'false' },
  test: {
    // Real Chromium (the Playwright install used by the smoke test), so canvas works.
    browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: 'chromium' }] },
    projects: [
      { extends: true, test: { name: 'dev', include: ['test/**/*.test.ts'], exclude: ['test/production.test.ts'] } },
      // Compiled as a consumer's production bundle: process.env.NODE_ENV replaced by "production".
      { extends: true, define: { 'process.env.NODE_ENV': '"production"' }, test: { name: 'production', include: ['test/production.test.ts'] } }
    ]
  }
});
