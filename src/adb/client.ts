/** ADB 命令封装(确定性操作层) */

import { execa } from 'execa';
import { writeFile } from 'node:fs/promises';
import type { AdbDevice, AdbOptions } from './types.js';

export const DEFAULT_ADB = 'adb';

/** 内部:拼 adb 调用参数 */
function buildArgs(args: string[], opts: AdbOptions): string[] {
  return [...(opts.serial ? ['-s', opts.serial] : []), ...args];
}

/** 执行 adb 命令,返回 stdout */
export async function adb(args: string[], opts: AdbOptions = {}): Promise<string> {
  const res = await execa(opts.adbPath ?? DEFAULT_ADB, buildArgs(args, opts));
  return res.stdout;
}

/** 执行 adb shell 命令 */
export async function shell(cmd: string, opts: AdbOptions = {}): Promise<string> {
  return adb(['shell', cmd], opts);
}

/** 列出已连接设备 */
export async function listDevices(opts: AdbOptions = {}): Promise<AdbDevice[]> {
  const out = await adb(['devices'], opts);
  const devices: AdbDevice[] = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^(\S+)\s+(\S+)\s*$/);
    if (m && m[1] && m[2] && m[1] !== 'List') {
      devices.push({ serial: m[1], state: m[2] });
    }
  }
  return devices;
}

/**
 * 确保有一个可用设备。
 * - 单设备:自动选中并返回 serial
 * - 多设备:必须显式传 opts.serial
 * - 无设备:抛错
 */
export async function ensureDevice(opts: AdbOptions = {}): Promise<string> {
  if (opts.serial) return opts.serial;
  const devices = await listDevices(opts);
  const online = devices.filter((d) => d.state === 'device');
  if (online.length === 0) {
    throw new Error('没有在线的 adb 设备。请先启动模拟器并确认 `adb devices` 可见。');
  }
  if (online.length > 1) {
    throw new Error(
      `检测到多个设备(${online.map((d) => d.serial).join(', ')}),请用 --serial 指定。`,
    );
  }
  const first = online[0];
  if (!first) throw new Error('未找到在线设备');
  return first.serial;
}

/** 点击坐标 */
export async function tap(x: number, y: number, opts: AdbOptions = {}): Promise<void> {
  await shell(`input tap ${x} ${y}`, opts);
}

/**
 * 输入文本。
 * 注意:adb `input text` 不支持中文(需 ADBKeyboard);空格用 %s。
 * 验证码/手机号等纯 ASCII 直接可用。
 */
export async function inputText(text: string, opts: AdbOptions = {}): Promise<void> {
  const escaped = text.replace(/ /g, '%s');
  await shell(`input text "${escaped}"`, opts);
}

/** 按键(常用:BACK=4, HOME=3, ENTER=66, DEL=67) */
export async function keyevent(keycode: number | string, opts: AdbOptions = {}): Promise<void> {
  await shell(`input keyevent ${keycode}`, opts);
}

/** 截图保存到本地文件 */
export async function screencap(outPath: string, opts: AdbOptions = {}): Promise<void> {
  const res = await execa(opts.adbPath ?? DEFAULT_ADB, buildArgs(['exec-out', 'screencap', '-p'], opts), {
    encoding: 'buffer',
  });
  await writeFile(outPath, res.stdout);
}

/** 导出当前 UI 树 XML */
export async function dumpUiXml(opts: AdbOptions = {}): Promise<string> {
  // dump 到设备文件,再 cat 出来(兼容性最好)
  await shell('uiautomator dump /sdcard/ui-dump.xml', opts);
  const xml = await shell('cat /sdcard/ui-dump.xml', opts);
  return xml;
}

/** 推送本地文件到设备 */
export async function push(local: string, remote: string, opts: AdbOptions = {}): Promise<void> {
  await adb(['push', local, remote], opts);
}

/** 触发媒体扫描,让推送的图片立刻出现在相册 */
export async function mediaScan(path: string, opts: AdbOptions = {}): Promise<void> {
  await shell(`am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://${path}`, opts);
}

/** 启动 App(通过 monkey,无需知道 Activity) */
export async function launchApp(pkg: string, opts: AdbOptions = {}): Promise<void> {
  await shell(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, opts);
}

/** 强制停止 App */
export async function stopApp(pkg: string, opts: AdbOptions = {}): Promise<void> {
  await shell(`am force-stop ${pkg}`, opts);
}

/** 当前前台 App 的包名(取 focused window) */
export async function currentPackage(opts: AdbOptions = {}): Promise<string | null> {
  try {
    const out = await shell('dumpsys activity activities | grep -E "ResumedActivity|mResumedActivity"', opts);
    const m = out.match(/([a-zA-Z0-9_.]+)\/[a-zA-Z0-9_.]+/);
    return m && m[1] ? m[1] : null;
  } catch {
    return null;
  }
}

export type {
  AdbOptions,
  AdbDevice,
} from './types.js';
