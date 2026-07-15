/**
 * B站 web 扫码登录集成测试(需真实环境:模拟器 + 已登录的 B站 App + 二维码图)。
 * 未设置 MYMY_RUN_E2E 时自动跳过。
 */

import { test, expect } from '@playwright/test';
import { execa } from 'execa';

const RUN = !!process.env.MYMY_RUN_E2E;
const QR = process.env.MYMY_TEST_QR ?? './login-qr.png';

test.describe('bili scan-web(需真实环境)', () => {
  test.skip(!RUN, '未设置 MYMY_RUN_E2E,跳过(需模拟器 + 已登录 B站 App + 二维码图)');

  test('端到端 web 扫码登录', async () => {
    const res = await execa('pnpm', ['cli', 'bili', 'scan-web', '--qr', QR], {
      reject: false,
      timeout: 90_000,
    });
    const json = JSON.parse(res.stdout) as { ok: boolean; pushedImage?: string };
    expect(json.ok).toBe(true);
  });
});
