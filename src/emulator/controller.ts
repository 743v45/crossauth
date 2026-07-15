/**
 * 模拟器高层控制器。
 * 封装「dump UI → 按 matcher 定位 → 点击/输入」的确定性操作循环,
 * 以及截图、推图、等待、窗口显隐等。基于 adb 层,不依赖 AI 视觉。
 */

import { execa } from 'execa';
import { setTimeout as sleep } from 'node:timers/promises';
import * as adb from '../adb/client.js';
import { parseUiDump, findFirst, findAll, center } from '../adb/ui-tree.js';
import type { AdbOptions, ElementMatcher, Point, UiNode } from '../adb/types.js';

export interface ControllerOptions {
  serial?: string;
  adbPath?: string;
}

export interface WaitForOptions {
  /** 总超时(ms),默认 30000 */
  timeout?: number;
  /** 轮询间隔(ms),默认 1000 */
  interval?: number;
}

export interface TapResult {
  point: Point;
  node: UiNode;
}

export class EmulatorController {
  private readonly opts: AdbOptions;

  constructor(o: ControllerOptions = {}) {
    this.opts = { serial: o.serial, adbPath: o.adbPath };
  }

  /** 确认设备并返回 serial */
  async ensure(): Promise<string> {
    return adb.ensureDevice(this.opts);
  }

  /** 截图保存到本地文件 */
  async screenshot(outPath: string): Promise<void> {
    await adb.screencap(outPath, this.opts);
  }

  /** 导出当前 UI 树(扁平化节点) */
  async dump(): Promise<UiNode[]> {
    const xml = await adb.dumpUiXml(this.opts);
    return parseUiDump(xml);
  }

  /** 导出原始 UI XML(调试/抓定位用) */
  async dumpXml(): Promise<string> {
    return adb.dumpUiXml(this.opts);
  }

  /** 点坐标 */
  async tap(x: number, y: number): Promise<void> {
    await adb.tap(x, y, this.opts);
  }

  /**
   * 按 matcher 定位元素并点击其中心。
   * @returns 命中的坐标与节点;定位失败返回 null
   */
  async tapElement(m: ElementMatcher): Promise<TapResult | null> {
    const nodes = await this.dump();
    const node = findFirst(nodes, m);
    if (!node) return null;
    const pt = center(node);
    if (!pt) return null;
    await adb.tap(pt.x, pt.y, this.opts);
    return { point: pt, node };
  }

  /** 点 text 完全匹配的元素 */
  async tapText(text: string): Promise<TapResult | null> {
    return this.tapElement({ text });
  }

  /** 点 text 包含的元素 */
  async tapTextContains(s: string): Promise<TapResult | null> {
    return this.tapElement({ textContains: s });
  }

  /** 输入文本(纯 ASCII 可靠,中文不支持) */
  async input(text: string): Promise<void> {
    await adb.inputText(text, this.opts);
  }

  /** 返回键 */
  async back(): Promise<void> {
    await adb.keyevent(4, this.opts);
  }

  /** Home 键 */
  async home(): Promise<void> {
    await adb.keyevent(3, this.opts);
  }

  /** 按键(数字 keycode 或字符串) */
  async keyevent(keycode: number | string): Promise<void> {
    await adb.keyevent(keycode, this.opts);
  }

  /** 启动 App */
  async launchApp(pkg: string): Promise<void> {
    await adb.launchApp(pkg, this.opts);
  }

  /** 强制停止 App */
  async stopApp(pkg: string): Promise<void> {
    await adb.stopApp(pkg, this.opts);
  }

  /** 当前前台包名 */
  async currentPackage(): Promise<string | null> {
    return adb.currentPackage(this.opts);
  }

  /**
   * 把本地图片推进模拟器相册(/sdcard/Pictures/)并触发媒体扫描,
   * 供 App「扫一扫 → 从相册选图」识别二维码。
   * @returns 设备上的图片路径
   */
  async pushImage(localPath: string, remoteName?: string): Promise<string> {
    const name = remoteName ?? `mymy-${Date.now()}.png`;
    const remote = `/sdcard/Pictures/${name}`;
    await adb.push(localPath, remote, this.opts);
    await adb.mediaScan(remote, this.opts);
    return remote;
  }

  /** 轮询直到界面出现匹配元素,返回该节点;超时返回 null */
  async waitFor(m: ElementMatcher, opts: WaitForOptions = {}): Promise<UiNode | null> {
    const timeout = opts.timeout ?? 30_000;
    const interval = opts.interval ?? 1000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const nodes = await this.dump();
      const node = findFirst(nodes, m);
      if (node) return node;
      await sleep(interval);
    }
    return null;
  }

  /** 等待特定 text 出现 */
  async waitForText(text: string, timeout?: number): Promise<UiNode | null> {
    return this.waitFor({ text }, { timeout });
  }

  /** 轮询直到匹配元素消失;超时返回 false */
  async waitForGone(m: ElementMatcher, opts: WaitForOptions = {}): Promise<boolean> {
    const timeout = opts.timeout ?? 30_000;
    const interval = opts.interval ?? 1000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const nodes = await this.dump();
      if (!findFirst(nodes, m)) return true;
      await sleep(interval);
    }
    return false;
  }

  /** 显示模拟器窗口(macOS:激活 Emulator 进程) */
  async showWindow(): Promise<boolean> {
    return setEmulatorWindowVisible(true);
  }

  /** 隐藏模拟器窗口(macOS:隐藏 Emulator 进程,保持运行) */
  async hideWindow(): Promise<boolean> {
    return setEmulatorWindowVisible(false);
  }
}

/**
 * 通过 osascript 控制 macOS 上 Emulator 进程的窗口可见性。
 * 仅 macOS 可用;非 macOS 抛错。只影响窗口可见性,可逆、无副作用。
 */
async function setEmulatorWindowVisible(visible: boolean): Promise<boolean> {
  if (process.platform !== 'darwin') {
    throw new Error('window show/hide 仅支持 macOS(控制 Emulator 进程窗口)');
  }
  try {
    if (visible) {
      await execa('osascript', ['-e', 'tell application "System Events" to set visible of (every process whose name is "Emulator") to true']);
      await execa('osascript', ['-e', 'tell application "Emulator" to activate']);
    } else {
      await execa('osascript', ['-e', 'tell application "System Events" to set visible of (every process whose name is "Emulator") to false']);
    }
    return true;
  } catch {
    return false;
  }
}
