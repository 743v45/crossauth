/** 二维码图片抓取:URL 下载或本地文件 */

import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 从 URL 下载图片到本地 */
export async function downloadImage(url: string, outPath: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载二维码失败 ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
  return outPath;
}

export interface ResolvedQr {
  path: string;
  /** 是否为临时文件(调用方负责清理) */
  temp: boolean;
}

/** 准备二维码图片:URL → 下载;本地路径 → 直接用 */
export async function resolveQrImage(source: string, cacheDir = '.'): Promise<ResolvedQr> {
  if (/^https?:\/\//.test(source)) {
    const out = join(cacheDir, `qr-${Date.now()}.png`);
    await downloadImage(source, out);
    return { path: out, temp: true };
  }
  try {
    await access(source);
  } catch {
    throw new Error(`二维码图片不存在: ${source}`);
  }
  return { path: source, temp: false };
}
