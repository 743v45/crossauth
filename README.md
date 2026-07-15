# mymy-auth

让 AI 全流程跑通「手机验证」:从 iPhone 拿短信验证码 + 用安卓模拟器里的 B站 App 扫码确认 web 登录,封装成**确定性 CLI**——模拟器内每一步都是固定脚本(基于 `uiautomator` 元素定位),不是 AI 视觉识别。

## 解决什么

调试 web 时经常重置浏览器 → B站 web 登录态丢失 → 反复扫码登录很烦。本工具把手机验证这层自动化:

- 模拟器里的 **B站 App 常驻登录**,作为「凭证源」
- 一条命令让 App 扫 web 二维码完成登录(走「相册识图」绕开模拟器无摄像头的问题)
- 首次登录用**短信验证码**,验证码从 iPhone 经 webhook 自动取回填入

## 架构

```
iPhone(收短信) ──快捷指令──▶ webhook ──▶ 服务缓存
                                            ▲
AI / Claude ──skill──▶ mymy CLI ──ADB──▶ 模拟器(B站 App)
                            ▲
PC 浏览器(B站 web 二维码)──┘
```

详见 [设计文档](docs/superpowers/specs/2026-07-15-mobile-auth-relay-design.md)。

## 快速开始

> 前置:服务器 Mac 需装 Android Studio + 系统镜像 + 模拟器 + B站 App(验证阶段处理)。

```bash
pnpm install
pnpm cli bili login --phone 138xxxx       # B站验证码登录(自动取短信)
pnpm cli bili scan-web --qr qr.png        # B站 App 扫 web 二维码登录
pnpm cli bili is-logged-in                # 查 B站登录态
```

## CLI 命令

| 命令 | 说明 |
|---|---|
| `mymy bili login --phone <手机号> [--dry-run]` | B站验证码登录,自动取短信并填入 |
| `mymy bili scan-web --qr <文件\|URL>` | B站 App 扫 web 二维码登录 |
| `mymy bili is-logged-in` | 查 B站登录态 |
| `mymy device screenshot` | 模拟器截图 |
| `mymy device dump-ui` | 导出 UI 树(调试/抓元素定位) |
| `mymy device window <show\|hide>` | 显示/隐藏模拟器窗口 |
| `mymy sms latest` | 看最新短信(调试) |
| `mymy webhook` | 启动短信 webhook 接收服务 |

## 状态

- [x] 代码骨架与确定性自动化框架
- [ ] 实测填入 B站真实元素定位(待装环境)
- [ ] iPhone 快捷指令联调
- [ ] 端到端验证

## 设计原则

1. **确定性优先**——模拟器内流程是固定脚本(元素定位 + 坐标点击),不依赖 AI 视觉
2. **页面已知**——每个页面元素定位预先抓取写死;App 改版只更新定位定义
3. **短信谨慎触发**——发码前先握手确认 iPhone→服务链路通,不通就不发(避免反复触发频率限制)
4. **CLI + skill**——不做 MCP,做成 CLI;Claude Code 通过 skill 调用
