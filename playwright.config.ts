import { defineConfig } from '@playwright/test';

/**
 * Playwright 配置(用于 integration-tests)。
 * 这些集成测试大多通过 child_process 调 CLI 或 HTTP 调 webhook,
 * 不需要浏览器;仅当未来引入真实浏览器操作时才需 `playwright install`。
 */
export default defineConfig({
  testDir: './integration-tests',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
});
