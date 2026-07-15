/** UI 树节点类型定义 */

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 一个扁平化后的 UI 节点(来自 uiautomator dump) */
export interface UiNode {
  resourceId: string;
  text: string;
  contentDesc: string;
  className: string;
  package: string;
  clickable: boolean;
  bounds: Bounds | null;
  index: number;
  /** 原始属性,调试用 */
  raw: Record<string, string>;
}

/** 元素定位条件(各字段为 AND 关系,undefined 表示不限制) */
export interface ElementMatcher {
  /** resource-id 包含匹配(自动兼容 "com.pkg:id/xxx" 前缀) */
  resourceId?: string;
  /** resource-id 完全相等 */
  resourceIdExact?: string;
  /** text 完全相等 */
  text?: string;
  /** text 包含 */
  textContains?: string;
  /** text 正则 */
  textRegex?: string;
  /** content-desc 完全相等 */
  contentDesc?: string;
  /** content-desc 包含 */
  descContains?: string;
  /** class 包含(如 "EditText"、"Button") */
  className?: string;
  /** package 完全相等 */
  package?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface AdbDevice {
  serial: string;
  state: string;
}

/** adb 调用选项 */
export interface AdbOptions {
  /** 设备序列号(多设备时必填) */
  serial?: string;
  /** adb 可执行路径,默认 "adb" */
  adbPath?: string;
}
