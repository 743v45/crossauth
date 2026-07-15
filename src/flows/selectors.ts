/**
 * B站 App 元素定位定义。
 *
 * ⚠️ 这些定位是基于 B站 App 常见 UI 的推测值。必须装好环境后,在真实 App 上
 *   用 `mymy device dump-ui`(或 `pnpm cli device dump-ui --out dump.xml`)抓取
 *   每个页面,找到目标元素的 resource-id / text,回填校正。
 *   校正前,流程脚本不保证成功——这是「页面已知确定」里"已知"的部分。
 */

import type { ElementMatcher } from '../adb/types.js';

/** B站 App 包名 */
export const BILIBILI_PACKAGE = 'tv.danmaku.bili';

export const biliSelectors = {
  /** 验证码登录入口(登录首页) */
  smsLoginEntry: {
    text: '验证码登录',
  } satisfies ElementMatcher,

  /** 手机号输入框 */
  phoneInput: {
    className: 'EditText',
    descContains: '手机号',
  } satisfies ElementMatcher,

  /** 「获取验证码」按钮 */
  getVerifyCodeButton: {
    textContains: '获取验证码',
  } satisfies ElementMatcher,

  /** 验证码输入框(点获取验证码后出现;TODO:实测用 resourceId 精确定位,避免误中手机号框) */
  verifyCodeInput: {
    className: 'EditText',
  } satisfies ElementMatcher,

  /** 登录按钮 */
  loginButton: {
    text: '登录',
  } satisfies ElementMatcher,

  /** 登录成功标志(首页底部 tab) */
  homeIndicator: {
    textContains: '我的',
  } satisfies ElementMatcher,

  /** 扫一扫入口 */
  scanEntry: {
    descContains: '扫一扫',
  } satisfies ElementMatcher,

  /** 扫一扫界面的「相册」按钮 */
  scanAlbumButton: {
    descContains: '相册',
  } satisfies ElementMatcher,

  /** 相册中第一张图(通常是最新;TODO:实测定位,可能需按 index 选第一个 ImageView) */
  albumFirstImage: {
    className: 'ImageView',
  } satisfies ElementMatcher,

  /** web 扫码登录的「确认登录」按钮 */
  confirmWebLoginButton: {
    textContains: '确认登录',
  } satisfies ElementMatcher,
} as const;
