/** 短信缓存 + 验证码提取(webhook 服务进程内单例) */

export interface SmsMessage {
  from: string;
  body: string;
  /** ISO 8601 时间 */
  receivedAt: string;
}

/**
 * 验证码提取正则。
 * 优先匹配「验证码 / verification code + 数字」,兜底匹配 4-8 位连续数字。
 */
const CODE_RE = /(?:验证码|验证码为|验证码是|verification\s*code|code)[^\d]{0,12}(\d{4,8})/i;
const DIGITS_RE = /\b(\d{4,8})\b/;

export interface CodeFilter {
  /** 发件人包含 */
  fromContains?: string;
  /** 正文包含 */
  bodyContains?: string;
  /** 仅取这段时间内收到的(ms) */
  sinceMs?: number;
}

export class SmsStore {
  private readonly messages: SmsMessage[] = [];

  add(m: SmsMessage): void {
    this.messages.push(m);
  }

  all(): readonly SmsMessage[] {
    return this.messages;
  }

  /** 最新一条(可带过滤) */
  latest(filter?: (m: SmsMessage) => boolean): SmsMessage | undefined {
    const arr = filter ? this.messages.filter(filter) : this.messages;
    if (arr.length === 0) return undefined;
    return arr[arr.length - 1];
  }

  /** 从最新匹配短信提取验证码 */
  getCode(filter: CodeFilter = {}): string | undefined {
    const now = Date.now();
    const pred = (m: SmsMessage): boolean => {
      if (filter.fromContains && !m.from.includes(filter.fromContains)) return false;
      if (filter.bodyContains && !m.body.includes(filter.bodyContains)) return false;
      if (filter.sinceMs !== undefined) {
        const ts = Date.parse(m.receivedAt);
        if (Number.isNaN(ts) || now - ts > filter.sinceMs) return false;
      }
      return true;
    };
    const msg = this.latest(pred);
    if (!msg) return undefined;
    const m1 = msg.body.match(CODE_RE);
    if (m1 && m1[1]) return m1[1];
    const m2 = msg.body.match(DIGITS_RE);
    return m2 && m2[1] ? m2[1] : undefined;
  }

  clear(): void {
    this.messages.length = 0;
  }
}

/** webhook 服务进程内的全局单例 */
export const store = new SmsStore();
