/**
 * sms webhook 端到端测试(不依赖模拟器/手机,可实际跑通)。
 * 验证完整短信链路:POST /sms → store → GET /sms/code、/sms/latest。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { handleSmsRequest } from '../src/sms/server.js';
import { store } from '../src/sms/store.js';

let server: Server | undefined;
let baseUrl = '';

beforeAll(async () => {
  store.clear();
  server = createServer((req, res) => {
    handleSmsRequest(req, res).catch(() => undefined);
  });
  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as { port: number } | null;
  baseUrl = `http://127.0.0.1:${addr?.port ?? 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe('sms webhook 端到端', () => {
  it('GET /health 返回 ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.ok).toBeTruthy();
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it('POST /sms 后能从 /sms/code 取到验证码', async () => {
    const resp = await fetch(`${baseUrl}/sms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        from: '1069xxxx',
        body: '【哔哩哔哩】您的验证码为 888888,5 分钟内有效',
        receivedAt: new Date().toISOString(),
      }),
    });
    expect(resp.ok).toBeTruthy();

    const codeResp = await fetch(`${baseUrl}/sms/code?bodyContains=哔哩哔哩`);
    const codeData = (await codeResp.json()) as { ok: boolean; code: string | null };
    expect(codeData.code).toBe('888888');
  });

  it('GET /sms/latest 返回最新短信正文', async () => {
    const res = await fetch(`${baseUrl}/sms/latest`);
    const data = (await res.json()) as { ok: boolean; message: { body: string } | null };
    expect(data.message?.body).toContain('哔哩哔哩');
  });

  it('非法 payload 返回 400', async () => {
    const res = await fetch(`${baseUrl}/sms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    expect(res.status).toBe(400);
  });

  it('未收到匹配短信时 /sms/code 返回 null', async () => {
    const res = await fetch(`${baseUrl}/sms/code?bodyContains=不存在的关键词`);
    const data = (await res.json()) as { ok: boolean; code: string | null };
    expect(data.code).toBeNull();
  });
});
