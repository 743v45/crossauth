import { defineConfig } from 'vitest/config';

/**
 * vitest 配置:只跑 tests/ 下的单测。
 * integration-tests/ 留给 Playwright(`pnpm test:e2e`),避免 vitest 误收 .spec.ts。
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['integration-tests/**', 'node_modules/**', 'dist/**'],
  },
});
