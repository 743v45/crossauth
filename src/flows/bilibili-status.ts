/** B站登录态查询 */

import { EmulatorController } from '../emulator/controller.js';
import { BILIBILI_PACKAGE } from './selectors.js';

export interface StatusResult {
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 当前前台包名 */
  frontPackage: string | null;
  /** 判定依据/提示 */
  note?: string;
}

/**
 * 查询登录态。
 * ⚠️ 确定性判定需实测:登录后 B站"我的"页有用户头像/昵称,未登录则有"点击登录"。
 *   这里先给框架,返回当前前台包名 + 待细化标志。
 */
export async function getLoginStatus(ctrl: EmulatorController): Promise<StatusResult> {
  let pkg = await ctrl.currentPackage();
  if (pkg !== BILIBILI_PACKAGE) {
    await ctrl.launchApp(BILIBILI_PACKAGE);
    pkg = BILIBILI_PACKAGE;
  }
  // TODO(实测):判定逻辑——
  //   已登录:进入"我的"页,存在用户昵称/头像节点
  //   未登录:存在"点击登录"节点
  // 可用:await ctrl.dump() 后 findFirst({ textContains: '点击登录' }) 等
  return {
    isLoggedIn: false,
    frontPackage: pkg,
    note: '登录态判定待实测填入(selectors + 本函数)。',
  };
}
