import { describe, it, expect } from 'vitest';
import {
  parseBounds,
  parseUiDump,
  findFirst,
  findCenter,
  center,
  findAll,
} from '../src/adb/ui-tree.js';

const SAMPLE_XML = `<?xml version='1.0' encoding='UTF-8'?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.bilibili.app" content-desc="" clickable="false" bounds="[0,0][1080,2400]">
    <node index="0" text="验证码登录" resource-id="com.bilibili.app:id/tv_sms_login" class="android.widget.TextView" package="com.bilibili.app" content-desc="" clickable="true" bounds="[100,200][400,260]" />
    <node index="1" text="" resource-id="com.bilibili.app:id/et_phone" class="android.widget.EditText" package="com.bilibili.app" content-desc="手机号" clickable="true" bounds="[100,400][980,500]" />
    <node index="2" text="登录" resource-id="com.bilibili.app:id/btn_login" class="android.widget.Button" package="com.bilibili.app" content-desc="" clickable="true" bounds="[100,700][980,800]" />
  </node>
</hierarchy>`;

describe('parseBounds', () => {
  it('解析 [l,t][r,b]', () => {
    expect(parseBounds('[100,200][400,260]')).toEqual({ left: 100, top: 200, right: 400, bottom: 260 });
  });
  it('无效输入返回 null', () => {
    expect(parseBounds('')).toBeNull();
    expect(parseBounds('abc')).toBeNull();
    expect(parseBounds('[1,2]')).toBeNull();
  });
});

describe('parseUiDump + 定位', () => {
  const nodes = parseUiDump(SAMPLE_XML);

  it('扁平化收集所有节点', () => {
    expect(nodes.length).toBe(4); // root + 3 children
  });

  it('按 resource-id 定位并解析 text/clickable', () => {
    const login = findFirst(nodes, { resourceId: 'tv_sms_login' });
    expect(login?.text).toBe('验证码登录');
    expect(login?.clickable).toBe(true);
  });

  it('resource-id 用 includes 匹配(兼容 com.pkg:id/ 前缀)', () => {
    const node = findFirst(nodes, { resourceId: 'et_phone' });
    expect(node?.resourceId).toBe('com.bilibili.app:id/et_phone');
  });

  it('按 content-desc 包含定位', () => {
    const phone = findFirst(nodes, { descContains: '手机号' });
    expect(phone?.resourceId).toContain('et_phone');
  });

  it('按 className 定位', () => {
    const edits = findAll(nodes, { className: 'EditText' });
    expect(edits.length).toBe(1);
    expect(edits[0]?.resourceId).toContain('et_phone');
  });

  it('按 text 精确与 textContains', () => {
    expect(findFirst(nodes, { text: '登录' })?.resourceId).toContain('btn_login');
    expect(findFirst(nodes, { textContains: '验证' })?.text).toBe('验证码登录');
  });

  it('findCenter 返回中心坐标', () => {
    const pt = findCenter(nodes, { text: '验证码登录' });
    expect(pt).toEqual({ x: 250, y: 230 });
  });

  it('center 计算中心', () => {
    const node = findFirst(nodes, { resourceId: 'tv_sms_login' });
    expect(node && center(node)).toEqual({ x: 250, y: 230 });
  });

  it('无匹配返回 undefined/null', () => {
    expect(findFirst(nodes, { text: '不存在' })).toBeUndefined();
    expect(findCenter(nodes, { text: '不存在' })).toBeNull();
  });
});
