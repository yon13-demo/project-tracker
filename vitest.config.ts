import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // Users are in Indonesia; date tests must not depend on the machine's time zone.
  test: { include: ['lib/**/*.test.ts'], env: { TZ: 'Asia/Jakarta' } },
});
