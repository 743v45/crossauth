#!/usr/bin/env node
/**
 * mymy CLI 入口(commander)。
 * 所有命令输出 JSON,失败退出码 1。
 */

import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { EmulatorController } from '../emulator/controller.js';
import { loginBySms } from '../flows/bilibili-login.js';
import { scanWebLogin } from '../flows/bilibili-scan-web.js';
import { getLoginStatus } from '../flows/bilibili-status.js';
import { getLatest } from '../sms/client.js';
import { startServer } from '../sms/server.js';

const program = new Command();
program
  .name('mymy')
  .description('手机验证中转:短信验证码 + 模拟器扫码登录,确定性 CLI')
  .version('0.1.0')
  .option('--serial <serial>', 'adb 设备序列号(多设备时指定)');

function serialOpt(): string | undefined {
  return program.opts().serial as string | undefined;
}

/** 输出 JSON 并按成功与否退出 */
function emit(r: unknown, ok: boolean): never {
  console.log(JSON.stringify(r, null, 2));
  process.exit(ok ? 0 : 1);
}

// ---------------- bili ----------------
const bili = program.command('bili').description('B站操作');

bili
  .command('login')
  .description('验证码登录 B站(自动取短信)')
  .requiredOption('--phone <phone>', '手机号')
  .option('--dry-run', '跑到发码前停下,不发短信')
  .option('--server-url <url>', 'webhook 地址(默认 http://localhost:7788)')
  .option('--code-timeout <ms>', '等验证码超时 ms', (v) => Number(v), 60000)
  .option('--body-contains <s>', '短信正文过滤(如 哔哩哔哩)')
  .action(async (opts) => {
    const ctrl = new EmulatorController({ serial: serialOpt() });
    const r = await loginBySms(ctrl, {
      phone: opts.phone as string,
      dryRun: opts.dryRun as boolean | undefined,
      serverUrl: opts.serverUrl as string | undefined,
      codeTimeout: opts.codeTimeout as number,
      bodyContains: opts.bodyContains as string | undefined,
    });
    emit(r, r.ok);
  });

bili
  .command('scan-web')
  .description('B站 App 扫 web 二维码登录')
  .requiredOption('--qr <source>', '二维码图片:URL 或本地路径')
  .option('--cache-dir <dir>', '临时文件目录', '.')
  .action(async (opts) => {
    const ctrl = new EmulatorController({ serial: serialOpt() });
    const r = await scanWebLogin(ctrl, {
      qr: opts.qr as string,
      cacheDir: opts.cacheDir as string,
    });
    emit(r, r.ok);
  });

bili
  .command('is-logged-in')
  .description('查 B站登录态')
  .action(async () => {
    const ctrl = new EmulatorController({ serial: serialOpt() });
    const r = await getLoginStatus(ctrl);
    emit(r, true);
  });

// ---------------- device ----------------
const device = program.command('device').description('模拟器/设备操作');

device
  .command('screenshot')
  .description('截图')
  .option('--out <path>', '输出文件', `screenshot-${Date.now()}.png`)
  .action(async (opts) => {
    const ctrl = new EmulatorController({ serial: serialOpt() });
    try {
      await ctrl.ensure();
      await ctrl.screenshot(opts.out as string);
      emit({ ok: true, path: opts.out }, true);
    } catch (e) {
      emit({ ok: false, error: String(e) }, false);
    }
  });

device
  .command('dump-ui')
  .description('导出 UI 树 XML(抓元素定位用)')
  .option('--out <path>', '输出文件(默认打印到 stdout)')
  .action(async (opts) => {
    const ctrl = new EmulatorController({ serial: serialOpt() });
    try {
      await ctrl.ensure();
      const xml = await ctrl.dumpXml();
      if (opts.out) {
        writeFileSync(opts.out as string, xml);
        emit({ ok: true, path: opts.out }, true);
      } else {
        console.log(xml);
        process.exit(0);
      }
    } catch (e) {
      emit({ ok: false, error: String(e) }, false);
    }
  });

device
  .command('window <state>')
  .description('显示/隐藏模拟器窗口(show|hide)')
  .action(async (state: string) => {
    const ctrl = new EmulatorController({ serial: serialOpt() });
    try {
      let ok = false;
      if (state === 'show') ok = await ctrl.showWindow();
      else if (state === 'hide') ok = await ctrl.hideWindow();
      emit({ ok, state }, ok);
    } catch (e) {
      emit({ ok: false, error: String(e) }, false);
    }
  });

// ---------------- sms ----------------
const smsCmd = program.command('sms').description('短信查询');

smsCmd
  .command('latest')
  .description('查最新短信')
  .option('--server-url <url>', 'webhook 地址')
  .option('--from-contains <s>', '发件人过滤')
  .option('--body-contains <s>', '正文过滤')
  .action(async (opts) => {
    const r = await getLatest(
      {
        fromContains: opts.fromContains as string | undefined,
        bodyContains: opts.bodyContains as string | undefined,
      },
      { serverUrl: opts.serverUrl as string | undefined },
    );
    console.log(JSON.stringify(r, null, 2));
  });

// ---------------- webhook ----------------
program
  .command('webhook')
  .description('启动短信 webhook 接收服务')
  .option('--port <n>', '端口', '7788')
  .action((opts) => {
    startServer(Number(opts.port));
  });

program.parse();
