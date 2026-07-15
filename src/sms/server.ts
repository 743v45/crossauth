/**
 * 短信 webhook 服务(原生 node:http)。
 * iPhone 快捷指令 POST /sms → 存入 store;
 * CLI 查询 GET /sms/latest、GET /sms/code;握手 GET /health。
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { store, type CodeFilter, type SmsMessage } from './store.js';

const startedAt = Date.now();

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => {
      buf += c;
      if (buf.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(buf ? JSON.parse(buf) : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

interface SmsPayload {
  from?: unknown;
  body?: unknown;
  receivedAt?: unknown;
}

/** 请求处理器(便于测试复用) */
export async function handleSmsRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'GET' && path === '/health') {
    json(res, 200, { ok: true, uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
    return;
  }

  if (method === 'POST' && path === '/sms') {
    const payload = (await readJson(req)) as SmsPayload | null;
    if (!payload || typeof payload.body !== 'string') {
      json(res, 400, { ok: false, error: 'invalid payload, need {body, from?, receivedAt?}' });
      return;
    }
    const msg: SmsMessage = {
      from: typeof payload.from === 'string' ? payload.from : '',
      body: payload.body,
      receivedAt:
        typeof payload.receivedAt === 'string' ? payload.receivedAt : new Date().toISOString(),
    };
    store.add(msg);
    json(res, 200, { ok: true, total: store.all().length });
    return;
  }

  if (method === 'GET' && path === '/sms/latest') {
    const fromContains = url.searchParams.get('fromContains') ?? undefined;
    const bodyContains = url.searchParams.get('bodyContains') ?? undefined;
    const msg = store.latest(
      (x) =>
        (!fromContains || x.from.includes(fromContains)) &&
        (!bodyContains || x.body.includes(bodyContains)),
    );
    json(res, 200, { ok: true, message: msg ?? null });
    return;
  }

  if (method === 'GET' && path === '/sms/code') {
    const sinceMsRaw = url.searchParams.get('sinceMs');
    const filter: CodeFilter = {
      fromContains: url.searchParams.get('fromContains') ?? undefined,
      bodyContains: url.searchParams.get('bodyContains') ?? undefined,
      sinceMs: sinceMsRaw ? Number(sinceMsRaw) : undefined,
    };
    const code = store.getCode(filter);
    json(res, 200, { ok: true, code: code ?? null });
    return;
  }

  if (method === 'GET' && (path === '/' || path === '')) {
    json(res, 200, {
      service: 'mymy-auth sms webhook',
      endpoints: ['POST /sms', 'GET /sms/latest', 'GET /sms/code', 'GET /health'],
    });
    return;
  }

  json(res, 404, { ok: false, error: 'not found' });
}

/** 启动 webhook 服务 */
export function startServer(port = 7788) {
  const server = createServer((req, res) => {
    handleSmsRequest(req, res).catch((e) => {
      try {
        json(res, 500, { ok: false, error: String(e) });
      } catch {
        // 响应已发送则忽略
      }
    });
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`[mymy] sms webhook listening on http://0.0.0.0:${port}`);
    console.log(`        iPhone 快捷指令请 POST 到 http://<本机局域网IP>:${port}/sms`);
  });
  return server;
}
