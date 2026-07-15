/** B站 web 扫码登录流程(模拟器 App 扫 web 二维码,走相册识图) */

import { EmulatorController } from '../emulator/controller.js';
import { biliSelectors, BILIBILI_PACKAGE } from './selectors.js';
import { resolveQrImage } from '../qr/grab.js';

export interface ScanWebOptions {
  /** 二维码图片来源:URL 或本地路径 */
  qr: string;
  /** 临时文件目录 */
  cacheDir?: string;
}

export interface ScanWebResult {
  ok: boolean;
  step: string;
  error?: string;
  pushedImage?: string;
}

export async function scanWebLogin(
  ctrl: EmulatorController,
  opts: ScanWebOptions,
): Promise<ScanWebResult> {
  const log = (s: string) => console.log(`[scan-web] ${s}`);

  // 1. 拿二维码图
  log('准备二维码图片');
  let imgPath: string;
  try {
    const r = await resolveQrImage(opts.qr, opts.cacheDir ?? '.');
    imgPath = r.path;
  } catch (e) {
    return { ok: false, step: 'resolve-qr', error: String(e) };
  }

  // 2. push 到相册
  log('推送二维码到模拟器相册');
  const remote = await ctrl.pushImage(imgPath);

  // 3. 启动 B站 + 打开扫一扫
  log('启动 B站 App');
  await ctrl.launchApp(BILIBILI_PACKAGE);
  log('打开「扫一扫」');
  const scanEntry = await ctrl.tapElement(biliSelectors.scanEntry);
  if (!scanEntry) {
    await ctrl.screenshot('screenshot-scan-entry.png').catch(() => undefined);
    return {
      ok: false,
      step: 'scan-entry',
      error: '找不到「扫一扫」入口,UI 路径需实测校正。已截图 screenshot-scan-entry.png。',
      pushedImage: remote,
    };
  }

  // 4. 点相册
  log('点击「相册」');
  const album = await ctrl.tapElement(biliSelectors.scanAlbumButton);
  if (!album) {
    return {
      ok: false,
      step: 'album-button',
      error: '找不到扫一扫界面的「相册」按钮。',
      pushedImage: remote,
    };
  }

  // 5. 选第一张(刚 push 的)
  log('选择最新图片');
  const firstImg = await ctrl.tapElement(biliSelectors.albumFirstImage);
  if (!firstImg) {
    return {
      ok: false,
      step: 'select-image',
      error: '无法选中相册图片(定位待实测)。',
      pushedImage: remote,
    };
  }

  // 6. 等待「确认登录」
  log('等待「确认登录 web 端」');
  const confirm = await ctrl.waitFor(biliSelectors.confirmWebLoginButton, { timeout: 15_000 });
  if (!confirm) {
    await ctrl.screenshot('screenshot-scan-result.png').catch(() => undefined);
    return {
      ok: false,
      step: 'wait-confirm',
      error: '扫码后未出现「确认登录」(可能二维码过期/识别失败)。已截图 screenshot-scan-result.png。',
      pushedImage: remote,
    };
  }

  // 7. 点确认
  log('点击「确认登录」');
  const confirmBtn = await ctrl.tapElement(biliSelectors.confirmWebLoginButton);
  if (!confirmBtn) {
    return { ok: false, step: 'confirm-button', error: '无法点击「确认登录」。', pushedImage: remote };
  }

  log('web 扫码登录完成');
  return { ok: true, step: 'done', pushedImage: remote };
}
