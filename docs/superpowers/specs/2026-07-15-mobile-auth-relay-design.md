# mymy-auth 设计文档

> 让 AI 全流程跑通手机验证:短信验证码 + 模拟器扫码确认 web 登录,封装为**确定性 CLI**。
> 创建:2026-07-15 · 状态:实现中(代码框架阶段)

---

## 1. 背景与目标

### 1.1 痛点
调试 web 时频繁重置浏览器 → B站 web 登录态丢失 → 反复手动扫码登录。手机验证(短信码 / 扫码确认)是自动化登录的最后一块拼图,AI/程序卡在"需要人拿手机"这一步。

### 1.2 目标
让 AI 通过一条 CLI 命令,端到端完成:
- **验证码登录**:模拟器 B站 App 用「手机号 + 短信验证码」首次登录,验证码自动从 iPhone 取回填入。
- **web 扫码登录**:模拟器里**已登录**的 B站 App 扫 PC 浏览器的登录二维码并确认,恢复 web 登录态。

### 1.3 非目标(本期不做)
- ❌ 不做 AI 视觉识别 → 改用确定性元素定位(`uiautomator`)
- ❌ 不做 MCP server → 改做 CLI + Claude Code skill
- ❌ 不做通用多平台 → 先 B站,架构预留扩展位
- ❌ 不依赖 root / 越狱

---

## 2. 整体架构

```
┌─────────────┐  ① 短信验证码(webhook)    ┌─────────────────────────────┐
│   iPhone    │ ──快捷指令自动化───────────▶│        服务器 Mac           │
│ (收B站短信) │                            │  ┌─────────────────────┐   │
└─────────────┘                            │  │  webhook(node:http) │   │
                                           │  │  + 短信缓存           │   │
┌─────────────┐  ② CLI 调用(子命令)         │  └──────────┬──────────┘   │
│  Claude/AI  │ ◀──skill───────────────────▶│             │              │
│ (编排大脑)  │                            │  ┌──────────▼──────────┐   │
└─────────────┘                            │  │   mymy CLI           │   │
                                           │  │   (flows + adb 层)   │   │
┌─────────────┐  ③ web 二维码图             │  └──────────┬──────────┘   │
│ PC 浏览器    │ ──push 到模拟器相册─────────▶│             │ ADB          │
│ (B站 web)   │                            │  ┌──────────▼──────────┐   │
└─────────────┘                            │  │  Android 模拟器      │   │
                                           │  │  (B站 App 常驻登录)  │   │
                                           │  └─────────────────────┘   │
                                           └─────────────────────────────┘
```

四个角色:**iPhone**(短信源) · **Claude/AI**(编排,通过 skill 调 CLI) · **服务器 Mac**(webhook + CLI + 模拟器同机) · **PC 浏览器**(web 二维码源)。

---

## 3. 组件清单

| 组件 | 位置 | 职责 |
|---|---|---|
| webhook 服务 | 服务器 Mac · [src/sms/server.ts](../../src/sms/server.ts) | 接收 iPhone POST 的短信,存入缓存 |
| 短信缓存 + 取码 | [src/sms/store.ts](../../src/sms/store.ts) | 内存缓存短信,正则提取验证码 |
| 链路握手 + 冷却 | [src/sms/client.ts](../../src/sms/client.ts) + [src/sms/cooldown.ts](../../src/sms/cooldown.ts) | 发码前 ping webhook 确认链路通;同号冷却(文件持久化) |
| ADB 操作层 | [src/adb/client.ts](../../src/adb/client.ts) | 封装 adb 命令(`execa`) |
| UI 树解析 | [src/adb/ui-tree.ts](../../src/adb/ui-tree.ts) | 解析 `uiautomator dump` XML,按 resource-id/text 定位元素坐标 |
| 模拟器控制器 | [src/emulator/controller.ts](../../src/emulator/controller.ts) | 高层操作:截图/点击/输入/等待/push图/窗口显隐 |
| B站流程脚本 | [src/flows/](../../src/flows/) | login(验证码) / scan-web(扫码) / status(登录态) |
| 元素定位定义 | [src/flows/selectors.ts](../../src/flows/selectors.ts) | 每个页面元素定位(占位,实测填) |
| 二维码抓取 | [src/qr/grab.ts](../../src/qr/grab.ts) | 从 URL/文件拿二维码图,push 到相册 |
| CLI 入口 | [src/cli/index.ts](../../src/cli/index.ts) | commander 挂载 bili/device/sms/webhook 子命令 |
| Claude Code skill | [skill/SKILL.md](../../skill/SKILL.md) | 包装 CLI,告诉 AI 命令清单与流程 |
| iPhone 快捷指令 | iPhone 端 | 收短信 → POST webhook(见 [iphone-shortcuts.md](../iphone-shortcuts.md)) |

---

## 4. 端到端流程

### 4.1 流程 A:验证码登录(模拟器 B站 App 首次登录)

```
mymy bili login --phone 138xxxxxxxx
```
1. **前置握手**:ping webhook 确认 iPhone→服务链路通(不通则**中止,不发码**)。
2. 启动 B站 App → 定位「验证码登录」入口 → 点击。
3. 定位手机号输入框 → `input(手机号)`。
4. 定位「获取验证码」按钮 → 点击(此刻 B站向 iPhone 发短信)。
5. iPhone 收短信 → 快捷指令 POST → webhook → 缓存。
6. CLI 轮询 `store.getCode()` → 拿到 6 位验证码。
7. 定位验证码输入框 → `input(验证码)` → 定位「登录」→ 点击。
8. `wait_for("首页" 或登录后标志)` 确认成功。
9. 返回结果(JSON)。

`--dry-run`:执行到第 3 步(填好手机号)后停下,**不点获取验证码**,用于确认页面定位无误。

### 4.2 流程 B:web 扫码登录(高频,恢复 web 登录态)

```
mymy bili scan-web --qr login-qr.png   # 或 --qr https://...
```
1. **拿二维码图**:从 URL 下载,或直接用本地文件。
2. `push_image_to_gallery(图)` → adb push 到 `/sdcard/Pictures/`,触发媒体扫描。
3. 启动/唤醒 B站 App → 定位「扫一扫」入口 → 点击。
4. 定位扫一扫界面的「相册」按钮 → 点击 → 选刚 push 的图。
5. App 识别二维码 → 跳转「确认登录 web 端」→ 定位「确认登录」→ 点击。
6. 返回结果(成功/失败)。

> 关键:模拟器**没有真摄像头**,App 无法扫 PC 屏幕。走「相册识图」绕开。二维码有时效(约 1~2 分钟),步骤 2~5 要快。

---

## 5. 关键技术决策

### 5.1 确定性 UI 定位(替代 AI 视觉)
- 用 `adb shell uiautomator dump` 导出当前页面 UI 树(XML)。
- 解析 XML,按 **resource-id**(首选) / **text** / **content-desc** 匹配目标元素,取其 `bounds` 中心坐标。
- `adb shell input tap <x> <y>` 点击。
- **优点**:快、稳、零 token;**页面已知确定**:每个页面定位在 [selectors.ts](../../src/flows/selectors.ts) 预先写死,App 改版只更新定位。
- 定位优先级:`resource-id` > `text` 精确 > `text` 包含 > 坐标兜底。

### 5.2 相册识图(绕开模拟器无摄像头)
- 二维码图 push 进模拟器相册 → 用 B站扫一扫「从相册选图」识别。
- 无需摄像头注入,稳定可靠。

### 5.3 短信链路握手 + 冷却
- 发码**前**先确认 webhook 链路可达(发一个 ping,iPhone 快捷指令回 pong,或服务端自检最近一次心跳)。
- 链路不通 → **不发短信**(避免发了收不到、反复触发 B站频率限制)。
- 同手机号 60s 冷却,防重复发码。

---

## 6. CLI 与 skill 设计

### 6.1 CLI 命令
| 命令 | 说明 |
|---|---|
| `mymy bili login --phone <号> [--dry-run]` | 验证码登录 |
| `mymy bili scan-web --qr <文件\|URL>` | web 扫码登录 |
| `mymy bili is-logged-in` | 查登录态 |
| `mymy device screenshot [--out]` | 截图 |
| `mymy device dump-ui [--out]` | 导出 UI 树(抓定位用) |
| `mymy device window <show\|hide>` | 显示/隐藏模拟器窗口 |
| `mymy sms latest [--filter]` | 看最新短信 |
| `mymy webhook [--port 7788]` | 启动 webhook 服务 |

所有命令输出 JSON(便于 AI 解析),`--human` 可选人类可读。

### 6.2 skill 包装
[skill/SKILL.md](../../skill/SKILL.md) 列出命令清单 + 两条典型流程,AI 读 skill 即知道如何驱动 CLI 完成「登录」。

---

## 7. 错误处理

| 场景 | 处理 |
|---|---|
| webhook 链路不通 | login 发码前中止,提示检查 iPhone 快捷指令/网络 |
| 短信超时未到(>60s) | 报错,提示重发;不自动重发(避免频率限制) |
| 元素定位失败 | dump 当前 UI 树保存,报错附截图,便于修 selectors |
| 扫码识别失败 | 重抓二维码图重试 1 次;仍失败报错 |
| 模拟器/ADB 掉线 | 检测 `adb devices`,报错提示重连 |
| 二维码过期 | 报错提示重新获取二维码 |

每步留截图 + UI 树日志,便于排查。

---

## 8. 验收标准

### 8.1 功能验收清单

| # | 验收项 | 对应测试 | 状态 |
|---|---|---|---|
| 1 | `device screenshot` 保存模拟器截图 | 手动 | ✅实现 ⬜手动 |
| 2 | `device dump-ui` 导出 UI 树 XML | 手动 | ✅实现 ⬜手动 |
| 3 | ui-tree 按 resource-id/text 定位元素并返回坐标 | [tests/ui-tree.test.ts](../../tests/ui-tree.test.ts) | ✅ 11 passed |
| 4 | webhook 收 POST → 短信进缓存,`sms latest` 可查 | [tests/sms-webhook.test.ts](../../tests/sms-webhook.test.ts) | ✅ 5 passed |
| 5 | 验证码正则从 body 提取 6 位码 | [tests/sms-store.test.ts](../../tests/sms-store.test.ts) | ✅ 8 passed |
| 6 | 链路不通时 `login` 不发码 | [integration-tests/bilibili-login.spec.ts](../../integration-tests/bilibili-login.spec.ts) | ✅实现 ⬜实测 |
| 7 | `login --dry-run` 跑到发码前停下 | [integration-tests/bilibili-login.spec.ts](../../integration-tests/bilibili-login.spec.ts) | ✅实现 ⬜实测 |
| 8 | `login --phone` 端到端验证码登录 | [integration-tests/bilibili-login.spec.ts](../../integration-tests/bilibili-login.spec.ts) | ⬜待实测 |
| 9 | `scan-web --qr` 端到端 web 扫码登录 | [integration-tests/bilibili-scan-web.spec.ts](../../integration-tests/bilibili-scan-web.spec.ts) | ⬜待实测 |
| 10 | `is-logged-in` 正确返回登录态 | 集成测试 | ✅框架 ⬜实测判定 |
| 11 | 模拟器窗口 show/hide 切换 | 手动 | ✅实现(osascript) ⬜手动 |

> 单测 24 passed(ui-tree / sms-store / sms-webhook)。8/9/10 需装 Android 环境 + iPhone 联调后实测。

### 8.2 测试轮次记录

| 轮次 | 日期 | 范围 | 结果 | 备注 |
|---|---|---|---|---|
| 1 | 2026-07-16 | 单测(ui-tree / sms-store / sms-webhook) | ✅ 24 passed | Node 22 / pnpm 10 / vitest |
| 2 | 待定 | B站真实流程(login / scan-web) | ⬜ | 待装 Android 环境 + iPhone 快捷指令 |

---

## 9. 风险与待实测项

| 风险 | 影响 | 缓解 |
|---|---|---|
| B站 App 检测模拟器,限制登录/扫码 | 流程 8/9 无法跑通 | 装好 B站 第一件事测登录;必要时换模拟器/真机 |
| B站改版导致 resource-id 变化 | 定位失效 | selectors 集中管理,改一处;`dump-ui` 辅助重抓 |
| 扫一扫「相册识图」UI 路径与预期不同 | 流程 9 卡住 | 实测抓真实路径填入 selectors |
| 二维码时效短 | 扫码超时 | CLI 步骤紧凑;失败提示重取 |
| iPhone「信息」自动化对 SMS 触发不稳 | 短信收不到 | 用关键词收紧触发;备选 Bark/Scriptable |
| 服务器 Mac 局域网 IP 变化 | webhook URL 失效 | 文档提示固定 IP / 用 mDNS 主机名 |

---

## 10. 模块结构

```
auth/
├── src/
│   ├── adb/
│   │   ├── client.ts        # adb 命令封装
│   │   ├── ui-tree.ts       # uiautomator XML 解析 + 元素定位
│   │   └── types.ts
│   ├── emulator/
│   │   └── controller.ts    # 高层操作
│   ├── sms/
│   │   ├── server.ts        # webhook 服务(node:http)
│   │   ├── store.ts         # 短信缓存 + 验证码正则
│   │   ├── client.ts        # CLI 侧:ping / 取码 / 轮询
│   │   └── cooldown.ts      # 发码冷却(文件持久化)
│   ├── qr/
│   │   └── grab.ts          # 二维码抓取 + push 相册
│   ├── flows/
│   │   ├── selectors.ts     # B站元素定位(占位)
│   │   ├── bilibili-login.ts
│   │   ├── bilibili-scan-web.ts
│   │   └── bilibili-status.ts
│   ├── cli/
│   │   └── index.ts         # commander 入口
│   └── index.ts
├── skill/
│   └── SKILL.md
├── integration-tests/
│   ├── bilibili-login.spec.ts
│   └── bilibili-scan-web.spec.ts
├── tests/
│   ├── ui-tree.test.ts
│   ├── sms-store.test.ts
│   └── sms-webhook.test.ts
└── docs/
    ├── superpowers/specs/2026-07-15-mobile-auth-relay-design.md
    └── iphone-shortcuts.md
```

---

## 11. 实现路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| **阶段 1** | 代码框架:adb/emulator/sms/flows/cli/skill/测试骨架 | ✅ 完成(单测 24 passed) |
| **阶段 2** | 装 Android Studio + 模拟器 + B站 App | ⬜(验证期) |
| **阶段 3** | 实测抓 B站元素定位,填 selectors | ⬜ |
| **阶段 4** | iPhone 快捷指令联调 + 端到端验收 | ⬜ |

---

## 12. 决策记录

- **2026-07-15**:用户否决"AI 视觉自主编排(MCP)"方案,改为"确定性脚本 CLI + skill"。理由:B站流程固定,元素定位比视觉更快更稳;CLI 比 MCP 更契合"程序化"诉求。
- **2026-07-15**:短信链路放弃"Mac 收 iMessage"(服务器 Mac 收不到),改走 iPhone 端快捷指令 webhook。
- **2026-07-15**:扫码放弃"摄像头注入",改走「相册识图」。
