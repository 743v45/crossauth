/**
 * CLI 侧短信客户端:向 webhook 服务查短信/验证码,并做发码前的链路握手。
 * webhook 是常驻服务,CLI 是命令行客户端,二者通过 HTTP 通信(跨进程)。
 */

import { setTimeout as sleep } from 'node:timers/promises';
import type { SmsMessage } from './store.js';

export interface SmsClientOptions {
  /** webhook 服务地址,默认读 MYMY_WEBHOOK_URL 或 http://localhost:7788 */
  serverUrl?: string;
}

export interface SmsFilter {
  fromContains?: string;
  bodyContains?: string;
  sinceMs?: number;
}

function base(opts: SmsClientOptions): string {
  return (opts.serverUrl ?? process.env.MYMY_WEBHOOK_URL ?? 'http://localhost:7788').replace(
    /\/$/,
    '',
  );
}

interface HealthResponse {
  ok: boolean;
  uptimeSec?: number;
}

interface CodeResponse {
  ok: boolean;
  code: string | null;
}

/** 握手:webhook 服务是否可达 */
export async function ping(opts: SmsClientOptions = {}): Promise<boolean> {
  try {
    const res = await fetch(`${base(opts)}/health`);
    if (!res.ok) return false;
    const data = (await res.json()) as HealthResponse;
    return data.ok === true;
  } catch {
    return false;
  }
}

/** 单次取验证码(没拿到返回 null) */
export async function getCode(filter: SmsFilter = {}, opts: SmsClientOptions = {}): Promise<string | null> {
  const u = new URL(`${base(opts)}/sms/code`);
  if (filter.fromContains) u.searchParams.set('fromContains', filter.fromContains);
  if (filter.bodyContains) u.searchParams.set('bodyContains', filter.bodyContains);
  if (filter.sinceMs !== undefined) u.searchParams.set('sinceMs', String(filter.sinceMs));
  const res = await fetch(u);
  const data = (await res.json()) as CodeResponse;
  return data.code;
}

/**
 * 轮询等待验证码。
 * 建议调用前先用 ping() 确认链路通,避免发码后收不到。
 */
export async function waitForCode(
  filter: SmsFilter = {},
  opts: { timeout?: number; interval?: number; serverUrl?: string } = {},
): Promise<string | null> {
  const timeout = opts.timeout ?? 60_000;
  const interval = opts.interval ?? 2000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const code = await getCode(filter, { serverUrl: opts.serverUrl });
    if (code) return code;
    await sleep(interval);
  }
  return null;
}

export interface LatestResponse {
  ok: boolean;
  message: SmsMessage | null;
}

/** 取最新短信(含完整正文) */
export async function getLatest(
  filter: { fromContains?: string; bodyContains?: string } = {},
  opts: SmsClientOptions = {},
): Promise<LatestResponse> {
  const u = new URL(`${base(opts)}/sms/latest`);
  if (filter.fromContains) u.searchParams.set('fromContains', filter.fromContains);
  if (filter.bodyContains) u.searchParams.set('bodyContains', filter.bodyContains);
  const res = await fetch(u);
  return (await res.json()) as LatestResponse;
}
