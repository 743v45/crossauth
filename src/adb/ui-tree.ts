/** uiautomator dump XML 解析 + 元素定位 */

import { XMLParser } from 'fast-xml-parser';
import type { Bounds, ElementMatcher, Point, UiNode } from './types.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
});

/** 解析 bounds 字符串 "[l,t][r,b]" → Bounds */
export function parseBounds(raw: string): Bounds | null {
  if (!raw) return null;
  const m = raw.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return null;
  const [, l, t, r, b] = m;
  if (l === undefined || t === undefined || r === undefined || b === undefined) return null;
  return {
    left: Number(l),
    top: Number(t),
    right: Number(r),
    bottom: Number(b),
  };
}

function toBool(v: string | undefined): boolean {
  return v === 'true';
}

/** 递归扁平化 fast-xml-parser 的解析结果,收集所有 node */
function collectNodes(obj: unknown, acc: UiNode[]): void {
  if (!obj || typeof obj !== 'object') return;
  // 数组:逐个处理
  if (Array.isArray(obj)) {
    for (const item of obj) collectNodes(item, acc);
    return;
  }
  const record = obj as Record<string, unknown>;
  // 一个 "node" 对象:有 class 属性视为 UI 节点
  if (typeof record.class === 'string' || typeof record['resource-id'] === 'string') {
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(record)) {
      if (typeof v === 'string') raw[k] = v;
    }
    acc.push({
      resourceId: raw['resource-id'] ?? '',
      text: raw.text ?? '',
      contentDesc: raw['content-desc'] ?? '',
      className: raw.class ?? '',
      package: raw.package ?? '',
      clickable: toBool(raw.clickable),
      bounds: parseBounds(raw.bounds ?? ''),
      index: raw.index !== undefined ? Number(raw.index) : 0,
      raw,
    });
  }
  // 递归子节点:属性之外的 key(子元素 node)
  for (const [k, v] of Object.entries(record)) {
    if (k === 'class' || k === 'text' || k === 'resource-id' || k === 'bounds') continue;
    if (k === 'content-desc' || k === 'package' || k === 'index' || k === 'clickable') continue;
    if (typeof v === 'string') continue; // 其余纯属性字符串
    collectNodes(v, acc);
  }
}

/** 解析整份 uiautomator dump XML,返回扁平化的节点列表 */
export function parseUiDump(xml: string): UiNode[] {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;
  const nodes: UiNode[] = [];
  // 结构:hierarchy → node(...)
  const hierarchy = parsed.hierarchy as Record<string, unknown> | undefined;
  if (hierarchy) {
    collectNodes(hierarchy, nodes);
  } else {
    collectNodes(parsed, nodes);
  }
  return nodes;
}

/** 判断单节点是否匹配 matcher */
export function matchNode(node: UiNode, m: ElementMatcher): boolean {
  if (m.resourceId !== undefined && !node.resourceId.includes(m.resourceId)) return false;
  if (m.resourceIdExact !== undefined && node.resourceId !== m.resourceIdExact) return false;
  if (m.text !== undefined && node.text !== m.text) return false;
  if (m.textContains !== undefined && !node.text.includes(m.textContains)) return false;
  if (m.textRegex !== undefined) {
    const re = new RegExp(m.textRegex);
    if (!re.test(node.text)) return false;
  }
  if (m.contentDesc !== undefined && node.contentDesc !== m.contentDesc) return false;
  if (m.descContains !== undefined && !node.contentDesc.includes(m.descContains)) return false;
  if (m.className !== undefined && !node.className.includes(m.className)) return false;
  if (m.package !== undefined && node.package !== m.package) return false;
  return true;
}

/** 找第一个匹配的节点 */
export function findFirst(nodes: UiNode[], m: ElementMatcher): UiNode | undefined {
  return nodes.find((n) => matchNode(n, m));
}

/** 找所有匹配的节点 */
export function findAll(nodes: UiNode[], m: ElementMatcher): UiNode[] {
  return nodes.filter((n) => matchNode(n, m));
}

/** 计算节点中心坐标 */
export function center(node: UiNode): Point | null {
  if (!node.bounds) return null;
  const b = node.bounds;
  return {
    x: Math.round((b.left + b.right) / 2),
    y: Math.round((b.top + b.bottom) / 2),
  };
}

/** 便捷:在节点列表中找匹配元素并返回中心坐标 */
export function findCenter(nodes: UiNode[], m: ElementMatcher): Point | null {
  const node = findFirst(nodes, m);
  return node ? center(node) : null;
}
