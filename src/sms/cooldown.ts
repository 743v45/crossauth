/**
 * 发码冷却:记录每个手机号上次「获取验证码」时间,冷却期内拒绝重复发码,
 * 避免反复触发 B站短信频率限制。
 * 持久化到 ./data/cooldown-<phone>.json(可由 MYMY_DATA_DIR 覆盖)。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

function dataDir(): string {
  return process.env.MYMY_DATA_DIR ?? join(process.cwd(), 'data');
}

function cooldownFile(phone: string): string {
  return join(dataDir(), `cooldown-${phone}.json`);
}

interface CooldownRecord {
  phone: string;
  lastSentAt: number;
}

/** 记录一次「获取验证码」触发 */
export async function recordSent(phone: string): Promise<void> {
  const file = cooldownFile(phone);
  await mkdir(dirname(file), { recursive: true });
  const rec: CooldownRecord = { phone, lastSentAt: Date.now() };
  await writeFile(file, JSON.stringify(rec), 'utf8');
}

/** 是否在冷却中(默认 60s) */
export async function isCoolingDown(phone: string, cooldownMs = 60_000): Promise<boolean> {
  try {
    const raw = await readFile(cooldownFile(phone), 'utf8');
    const rec = JSON.parse(raw) as CooldownRecord;
    return Date.now() - rec.lastSentAt < cooldownMs;
  } catch {
    return false;
  }
}

/** 距离可再次发码的剩余毫秒(已可发返回 0) */
export async function remainingCooldown(phone: string, cooldownMs = 60_000): Promise<number> {
  try {
    const raw = await readFile(cooldownFile(phone), 'utf8');
    const rec = JSON.parse(raw) as CooldownRecord;
    return Math.max(0, cooldownMs - (Date.now() - rec.lastSentAt));
  } catch {
    return 0;
  }
}
