/** B站「手机号 + 短信验证码」登录流程(确定性脚本) */

import { EmulatorController } from '../emulator/controller.js';
import { biliSelectors, BILIBILI_PACKAGE } from './selectors.js';
import { ping, waitForCode } from '../sms/client.js';
import { isCoolingDown, recordSent, remainingCooldown } from '../sms/cooldown.js';

export interface LoginOptions {
  phone: string;
  /** 只跑到发码前停下,不发短信(用于验证页面定位) */
  dryRun?: boolean;
  /** webhook 服务地址 */
  serverUrl?: string;
  /** 等验证码超时(ms),默认 60000 */
  codeTimeout?: number;
  /** 短信正文过滤(如 "哔哩哔哩") */
  bodyContains?: string;
}

export interface LoginResult {
  ok: boolean;
  step: string;
  phone?: string;
  verifyCode?: string;
  error?: string;
}

export async function loginBySms(
  ctrl: EmulatorController,
  opts: LoginOptions,
): Promise<LoginResult> {
  const log = (s: string) => console.log(`[login] ${s}`);
  const codeTimeout = opts.codeTimeout ?? 60_000;

  // 1. 握手:确认 webhook 链路可达(不通就不发短信)
  log('握手:检查 webhook 是否可达');
  const reachable = await ping({ serverUrl: opts.serverUrl });
  if (!reachable) {
    return {
      ok: false,
      step: 'handshake',
      error:
        'webhook 不可达,未发短信。请确认 webhook 服务已启动(pnpm webhook)且 iPhone 快捷指令链路正常。',
    };
  }

  // 2. 冷却检查(避免反复触发频率限制)
  if (await isCoolingDown(opts.phone)) {
    const remain = Math.ceil((await remainingCooldown(opts.phone)) / 1000);
    return {
      ok: false,
      step: 'cooldown',
      error: `该手机号 ${remain}s 内已发过验证码,冷却中。`,
    };
  }

  // 3. 启动 B站,等登录入口
  log('启动 B站 App');
  await ctrl.launchApp(BILIBILI_PACKAGE);
  const entryVisible = await ctrl.waitFor(biliSelectors.smsLoginEntry, { timeout: 15_000 });
  if (!entryVisible) {
    // 可能已经登录(没有登录入口)。查登录态更合理,这里先提示
    log('未发现「验证码登录」入口(可能已登录),继续尝试定位...');
  }

  // 4. 点验证码登录
  log('点击「验证码登录」');
  const entry = await ctrl.tapElement(biliSelectors.smsLoginEntry);
  if (!entry) {
    await ctrl.screenshot('screenshot-login-entry.png').catch(() => undefined);
    return {
      ok: false,
      step: 'sms-login-entry',
      error: '找不到「验证码登录」入口,可能已登录或 UI 变了。已截图 screenshot-login-entry.png。',
    };
  }

  // 5. 输入手机号
  log('输入手机号');
  const phoneInput = await ctrl.tapElement(biliSelectors.phoneInput);
  if (!phoneInput) {
    return { ok: false, step: 'phone-input', error: '找不到手机号输入框。' };
  }
  await ctrl.input(opts.phone);

  if (opts.dryRun) {
    log('dry-run:停在发码前(未发短信)');
    return { ok: true, step: 'dry-run', phone: opts.phone };
  }

  // 6. 点「获取验证码」(此刻 B站向 iPhone 发短信)
  log('点击「获取验证码」');
  const getCodeBtn = await ctrl.tapElement(biliSelectors.getVerifyCodeButton);
  if (!getCodeBtn) {
    return { ok: false, step: 'get-code-button', error: '找不到「获取验证码」按钮。' };
  }
  await recordSent(opts.phone);

  // 7. 等验证码(从 webhook 取)
  log('等待 iPhone 收到验证码...');
  const filter = {
    bodyContains: opts.bodyContains,
    sinceMs: 120_000,
  };
  const code = await waitForCode(filter, { timeout: codeTimeout, serverUrl: opts.serverUrl });
  if (!code) {
    return {
      ok: false,
      step: 'wait-code',
      error: `等待验证码超时(${codeTimeout / 1000}s)。检查 iPhone 是否收到、快捷指令是否转发。`,
    };
  }
  log(`收到验证码: ${code}`);

  // 8. 填验证码
  const codeInput = await ctrl.tapElement(biliSelectors.verifyCodeInput);
  if (!codeInput) {
    return { ok: false, step: 'code-input', error: '找不到验证码输入框。', verifyCode: code };
  }
  await ctrl.input(code);

  // 9. 点登录
  log('点击「登录」');
  const loginBtn = await ctrl.tapElement(biliSelectors.loginButton);
  if (!loginBtn) {
    return { ok: false, step: 'login-button', error: '找不到登录按钮。', verifyCode: code };
  }

  // 10. 确认登录成功
  log('确认登录成功');
  const home = await ctrl.waitFor(biliSelectors.homeIndicator, { timeout: 20_000 });
  if (!home) {
    await ctrl.screenshot('screenshot-after-login.png').catch(() => undefined);
    return {
      ok: false,
      step: 'verify-success',
      error: '点击登录后未检测到首页标志(可能需要二次验证/滑块)。已截图 screenshot-after-login.png。',
      verifyCode: code,
    };
  }

  log('登录成功');
  return { ok: true, step: 'done', phone: opts.phone, verifyCode: code };
}
