/**
 * B站验证码登录集成测试(需真实环境:模拟器 + B站 App + iPhone 快捷指令)。
 * 未设置 MYMY_RUN_E2E 时自动跳过。
 */

import { test, expect } from '@playwright/test';
import { execa } from 'execa';

const RUN = !!process.env.MYMY_RUN_E2E;
const PHONE = process.env.MYMY_TEST_PHONE ?? '13800000000';

test.describe('bili login(需真实环境)', () => {
  test.skip(!RUN, '未设置 MYMY_RUN_E2E,跳过(需模拟器 + B站 App + iPhone)');

  test('dry-run 跑到发码前停下,不发短信', async () => {
    const res = await execa('pnpm', ['cli', 'bili', 'login', '--phone', PHONE, '--dry-run'], {
      reject: false,
    });
    const json = JSON.parse(res.stdout) as { ok: boolean; step: string };
    expect(json.ok).toBe(true);
    expect(json.step).toBe('dry-run');
  });

  test('端到端验证码登录', async () => {
    const res = await execa(
      'pnpm',
      ['cli', 'bili', 'login', '--phone', PHONE, '--body-contains', '哔哩哔哩'],
      { reject: false, timeout: 120_000 },
    );
    const json = JSON.parse(res.stdout) as { ok: boolean; verifyCode?: string };
    expect(json.ok).toBe(true);
    expect(json.verifyCode).toBeTruthy();
  });
});
