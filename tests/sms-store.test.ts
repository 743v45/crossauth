import { describe, it, expect, beforeEach } from 'vitest';
import { SmsStore } from '../src/sms/store.js';

describe('SmsStore', () => {
  let s: SmsStore;
  beforeEach(() => {
    s = new SmsStore();
  });

  it('add + latest 返回最新', () => {
    s.add({ from: '1061', body: '旧', receivedAt: '2026-07-15T10:00:00Z' });
    s.add({ from: '1062', body: '新', receivedAt: '2026-07-15T11:00:00Z' });
    expect(s.latest()?.body).toBe('新');
  });

  it('latest 支持过滤', () => {
    s.add({ from: '1061', body: 'A', receivedAt: '2026-07-15T10:00:00Z' });
    s.add({ from: '1062', body: 'B', receivedAt: '2026-07-15T11:00:00Z' });
    expect(s.latest((m) => m.from.includes('1061'))?.body).toBe('A');
  });

  it('getCode 提取"验证码为 123456"', () => {
    s.add({
      from: '1069',
      body: '【哔哩哔哩】您的验证码为 123456,5分钟内有效',
      receivedAt: new Date().toISOString(),
    });
    expect(s.getCode()).toBe('123456');
  });

  it('getCode 兜底纯数字 code', () => {
    s.add({ from: '1069', body: 'Your code: 654321', receivedAt: new Date().toISOString() });
    expect(s.getCode()).toBe('654321');
  });

  it('getCode 无匹配返回 undefined', () => {
    expect(s.getCode()).toBeUndefined();
  });

  it('getCode bodyContains 过滤', () => {
    s.add({ from: '10086', body: '验证码 111111', receivedAt: new Date().toISOString() });
    s.add({ from: '1069', body: '【哔哩哔哩】验证码 222222', receivedAt: new Date().toISOString() });
    expect(s.getCode({ bodyContains: '哔哩哔哩' })).toBe('222222');
  });

  it('getCode sinceMs 过滤过期短信', () => {
    const old = new Date(Date.now() - 600_000).toISOString(); // 10 分钟前
    s.add({ from: '1069', body: '验证码 333333', receivedAt: old });
    expect(s.getCode({ sinceMs: 60_000 })).toBeUndefined();
  });

  it('clear 清空', () => {
    s.add({ from: 'x', body: 'y', receivedAt: new Date().toISOString() });
    s.clear();
    expect(s.latest()).toBeUndefined();
  });
});
